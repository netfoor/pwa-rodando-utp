/**
 * Canal en tiempo real del seguimiento en vivo (WebSocket sobre el mismo
 * servidor HTTP). Autentica con el JWT del usuario, valida que sea participante
 * del viaje y difunde posiciones y cambios de estado solo a esa sala.
 */
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import * as vivo from "./services/vivo.service.js";

const RUTA = "/api/vivo/ws";
const salas = new Map();
const clave = (raiteId, fecha) => `${raiteId}:${fecha}`;

function usuarioDelToken(token) {
  if (!token) return null;
  try {
    const p = jwt.verify(token, env.jwtSecret);
    return { id: Number(p.sub), rol: p.rol };
  } catch {
    return null;
  }
}

function enviar(ws, datos) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(datos));
}

function entrar(ws, raiteId, fecha) {
  salir(ws);
  ws.raiteId = raiteId;
  ws.fecha = fecha;
  const k = clave(raiteId, fecha);
  if (!salas.has(k)) salas.set(k, new Set());
  salas.get(k).add(ws);
  return k;
}

function salir(ws) {
  if (!ws.raiteId) return;
  const k = clave(ws.raiteId, ws.fecha);
  const sala = salas.get(k);
  if (sala) {
    sala.delete(ws);
    if (!sala.size) salas.delete(k);
  }
  ws.raiteId = null;
}

/** Envía un mensaje a todos los suscriptores de un viaje. */
export function difundir(raiteId, fecha, datos) {
  const sala = salas.get(clave(raiteId, fecha));
  if (!sala) return 0;
  for (const ws of sala) enviar(ws, datos);
  return sala.size;
}

/** Recalcula la estimación de cada suscriptor y les manda la posición. */
export async function difundirPosicion(raiteId, fecha) {
  const sala = salas.get(clave(raiteId, fecha));
  if (!sala?.size) return;
  await Promise.all([...sala].map(async ws => {
    try {
      if (!(await vivo.puedeVer(raiteId, fecha, ws.usuario))) {
        enviar(ws, { tipo: "error", code: "PROHIBIDO", message: "Solo los participantes del viaje ven el auto" });
        salir(ws);
        return;
      }
      const { estado, posicion } = await vivo.posicionParaUsuario(raiteId, fecha, ws.usuario);
      enviar(ws, { tipo: "posicion", estado, posicion });
    } catch {
      enviar(ws, { tipo: "error", code: "SIN_VIAJE", message: "El viaje no está disponible" });
    }
  }));
}

/** Engancha el servidor WebSocket al servidor HTTP existente. */
export function attachRealtime(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== RUTA) return socket.destroy();
    const usuario = usuarioDelToken(url.searchParams.get("token"));
    if (!usuario) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, ws => {
      ws.usuario = usuario;
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", ws => {
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("message", async raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return enviar(ws, { tipo: "error", code: "MENSAJE_INVALIDO", message: "Formato inválido" }); }
      if (msg.tipo === "ping") return enviar(ws, { tipo: "pong" });

      const raiteId = Number(msg.raiteId);
      if (!Number.isInteger(raiteId) || raiteId <= 0) {
        return enviar(ws, { tipo: "error", code: "RAITE_INVALIDO", message: "Falta el raite" });
      }
      const fecha = /^\d{4}-\d{2}-\d{2}$/.test(msg.fecha || "") ? msg.fecha : vivo.fechaMx();

      try {
        if (msg.tipo === "suscribir") {
          if (!(await vivo.puedeVer(raiteId, fecha, ws.usuario))) {
            return enviar(ws, { tipo: "error", code: "PROHIBIDO", message: "Solo los participantes del viaje ven el auto" });
          }
          entrar(ws, raiteId, fecha);
          const { estado, posicion } = await vivo.posicionParaUsuario(raiteId, fecha, ws.usuario);
          enviar(ws, { tipo: "suscrito", raiteId, fecha, estado, posicion });
          return;
        }

        if (msg.tipo === "posicion") {
          const { lat, lng, precision, velocidad, rumbo } = msg;
          if (![lat, lng].every(n => typeof n === "number" && Number.isFinite(n))) {
            return enviar(ws, { tipo: "error", code: "POSICION_INVALIDA", message: "Coordenadas inválidas" });
          }
          await vivo.actualizarPosicion(ws.usuario, raiteId, {
            lat, lng, precision: Number(precision) || null, velocidad: Number(velocidad) || null,
            rumbo: Number(rumbo) || null, fecha
          });
          await difundirPosicion(raiteId, fecha);
          return;
        }

        enviar(ws, { tipo: "error", code: "TIPO_DESCONOCIDO", message: "Acción no reconocida" });
      } catch (err) {
        enviar(ws, { tipo: "error", code: err.code || "ERROR", message: err.message });
      }
    });
    ws.on("close", () => salir(ws));
    ws.on("error", () => salir(ws));
  });

  const latido = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  latido.unref?.();
  wss.on("close", () => clearInterval(latido));
  return wss;
}

/** Solo para pruebas: cuántos clientes siguen un viaje. */
export const suscriptores = (raiteId, fecha) => salas.get(clave(raiteId, fecha))?.size ?? 0;
