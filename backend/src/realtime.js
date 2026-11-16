/**
 * Canal en tiempo real del seguimiento en vivo (WebSocket sobre el mismo
 * servidor HTTP). Autentica con un ticket efímero (o el JWT normal como
 * respaldo), valida que sea participante del viaje y difunde posiciones y
 * cambios de estado solo a esa sala.
 */
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import * as vivo from "./services/vivo.service.js";
import { wsMensajeSchema } from "./schemas/vivo.schema.js";

const RUTA = "/api/vivo/ws";
const AUDIENCIA = "vivo-ws";
const MAX_MENSAJES = 30;
const VENTANA_MS = 10 * 1000;
const salas = new Map();
const clave = (raiteId, fecha) => `${raiteId}:${fecha}`;

/** Ticket de corta vida para abrir el WebSocket sin exponer el JWT de sesión. */
export const firmarTicket = user =>
  jwt.sign({ sub: user.id, rol: user.rol }, env.jwtSecret, { expiresIn: "60s", audience: AUDIENCIA });

function verificar(token, opciones) {
  try { return jwt.verify(token, env.jwtSecret, opciones); } catch { return null; }
}

function usuarioDelToken(token) {
  if (!token) return null;
  const ticket = verificar(token, { audience: AUDIENCIA });
  const p = ticket || verificar(token);
  if (!p) return null;
  return { id: Number(p.sub), rol: p.rol };
}

/** En producción el navegador solo puede abrir el canal desde el mismo sitio o los orígenes permitidos. */
function origenPermitido(req) {
  if (!env.isProd) return true;
  const origin = req.headers.origin;
  if (!origin) return true; // clientes sin navegador (CLI/móvil nativo) no envían Origin
  try {
    if (new URL(origin).host === req.headers.host) return true;
  } catch {
    return false;
  }
  return env.allowedOrigins.includes(origin);
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
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== RUTA) return socket.destroy();
    if (!origenPermitido(req)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      return socket.destroy();
    }
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
    ws.msgWindow = Date.now();
    ws.msgCount = 0;
    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("message", async raw => {
      const ahora = Date.now();
      if (ahora - ws.msgWindow > VENTANA_MS) {
        ws.msgWindow = ahora;
        ws.msgCount = 0;
      }
      if (++ws.msgCount > MAX_MENSAJES) {
        enviar(ws, { tipo: "error", code: "DEMASIADOS_MENSAJES", message: "Demasiados mensajes, vuelve a conectar" });
        return ws.close(1008, "Demasiados mensajes");
      }

      let msg;
      try { msg = JSON.parse(raw); } catch { return enviar(ws, { tipo: "error", code: "MENSAJE_INVALIDO", message: "Formato inválido" }); }
      const parsed = wsMensajeSchema.safeParse(msg);
      if (!parsed.success) {
        return enviar(ws, { tipo: "error", code: "MENSAJE_INVALIDO", message: "Mensaje inválido" });
      }
      msg = parsed.data;
      if (msg.tipo === "ping") return enviar(ws, { tipo: "pong" });

      const { raiteId } = msg;
      const fecha = msg.fecha || vivo.fechaMx();

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
          await vivo.actualizarPosicion(ws.usuario, raiteId, {
            lat, lng, precision: precision ?? null, velocidad: velocidad ?? null,
            rumbo: rumbo ?? null, fecha
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
