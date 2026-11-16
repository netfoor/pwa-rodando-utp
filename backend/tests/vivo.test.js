import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { app } from "../src/app.js";
import { attachRealtime } from "../src/realtime.js";
import { query } from "../src/db/pool.js";
import { api, nuevoUsuario } from "./helpers.js";

/** Próximo lunes en formato AAAA-MM-DD, para que las pruebas no dependan del día real. */
const proximoLunes = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
};
const FECHA = proximoLunes();

async function escenario(asientos = 2) {
  const cond = await nuevoUsuario({ rol: "conductor", auto: "Kia de prueba" });
  const res = await api().post("/api/raites").set(cond.auth).send({
    zona: "centro", tipo: "ida", hora: "06:00", dias: [0], asientos, aportacion: 10,
    paradas: ["Zócalo", "Paseo Bravo"]
  });
  return { cond, raite: res.body };
}

const ver = (id, u, extra = "") => {
  const req = api().get(`/api/vivo/${id}?fecha=${FECHA}${extra}`);
  return u ? req.set(u.auth) : req;
};

const solicitar = (u, id, extra = {}) =>
  api().post(`/api/vivo/${id}/solicitar`).set(u.auth)
    .send({ parada: "Zócalo", nombre: "Pasajero Prueba", fecha: FECHA, ...extra });

const mover = (cond, id, lat, lng, extra = {}) =>
  api().post(`/api/vivo/${id}/posicion`).set(cond.auth)
    .send({ lat, lng, precision: 8, velocidad: 10, fecha: FECHA, ...extra });

describe("seguimiento en vivo", () => {
  it("estado público: ruta y campus sin posición del auto", async () => {
    const { raite } = await escenario();
    const res = await ver(raite.id);
    expect(res.status).toBe(200);
    expect(res.body.estadoViaje).toBe("programado");
    expect(res.body.posicion).toBeNull();
    expect(res.body.puedeVer).toBe(false);
    expect(res.body.participantes).toBeUndefined();
    expect(res.body.solicitudesPendientes).toBeUndefined();
    expect(res.body.ruta.length).toBeGreaterThan(3);
    expect(res.body.origen).toHaveLength(2);
    expect(res.body.campus[0]).toBeCloseTo(19.0584, 3);
    expect(res.body.raite.zona.nombre).toBe("Centro Histórico");
    expect((await api().get("/api/vivo/999999")).status).toBe(404);
  });

  it("solo el conductor dueño inicia, mueve y finaliza el viaje", async () => {
    const { cond, raite } = await escenario();
    const otro = await nuevoUsuario({ rol: "conductor", auto: "Otro auto" });
    expect((await api().post(`/api/vivo/${raite.id}/iniciar`).set(otro.auth).send({ fecha: FECHA })).status).toBe(403);
    const ini = await api().post(`/api/vivo/${raite.id}/iniciar`).set(cond.auth).send({ fecha: FECHA });
    expect(ini.status).toBe(201);
    expect(ini.body.viaje.estado).toBe("en_camino");
    expect((await mover(otro, raite.id, 19.0428, -98.1983)).status).toBe(403);
    expect((await api().post(`/api/vivo/${raite.id}/finalizar`).set(otro.auth).send({ fecha: FECHA })).status).toBe(403);
  });

  it("filtra posiciones con precisión mayor a 30 m y las reserva a los participantes", async () => {
    const { cond, raite } = await escenario();
    await api().post(`/api/vivo/${raite.id}/iniciar`).set(cond.auth).send({ fecha: FECHA });
    expect((await mover(cond, raite.id, 19.0428, -98.1983, { precision: 55 })).status).toBe(400);
    const [lat, lng] = (await ver(raite.id)).body.ruta[0];
    const ok = await mover(cond, raite.id, lat, lng);
    expect(ok.status).toBe(200);
    expect(ok.body.posicion.etaMin).toBeGreaterThan(0);

    expect((await ver(raite.id)).body.posicion).toBeNull();
    const ajeno = await nuevoUsuario();
    expect((await ver(raite.id, ajeno)).body.posicion).toBeNull();

    const p = await nuevoUsuario();
    const sol = await solicitar(p, raite.id);
    expect(sol.status).toBe(201);
    expect(sol.body.estado).toBe("pendiente");
    const suya = await ver(raite.id, p);
    expect(suya.body.posicion).not.toBeNull();
    expect(suya.body.posicion.etaMin).toBeGreaterThan(0);
    expect(suya.body.miReserva).toMatchObject({ estado: "pendiente", parada: "Zócalo" });
    expect(suya.body.puedeVer).toBe(true);
    expect(suya.body.participantes).toBe(0);
    expect(suya.body.solicitudesPendientes).toBe(1);
    expect((await ver(raite.id, cond)).body.solicitudesPendientes).toBe(1);
  });

  it("solicitar dos veces, aceptar, rechazar y quedarse sin cupo", async () => {
    const { cond, raite } = await escenario(1);
    await api().post(`/api/vivo/${raite.id}/iniciar`).set(cond.auth).send({ fecha: FECHA });
    const [lat, lng] = (await ver(raite.id)).body.ruta[2];
    await mover(cond, raite.id, lat, lng);

    const a = await nuevoUsuario(), b = await nuevoUsuario();
    const sa = await solicitar(a, raite.id);
    expect((await solicitar(a, raite.id)).status).toBe(409);
    const sb = await solicitar(b, raite.id, { nombre: undefined });
    expect(sb.status).toBe(201);

    expect((await api().get(`/api/vivo/${raite.id}/solicitudes?fecha=${FECHA}`).set(a.auth)).status).toBe(403);
    const lista = await api().get(`/api/vivo/${raite.id}/solicitudes?fecha=${FECHA}`).set(cond.auth);
    expect(lista.body.solicitudes).toHaveLength(2);
    expect(lista.body.solicitudes[0].parada).toBe("Zócalo");
    expect(lista.body.solicitudes[0].etaMin).toBeGreaterThanOrEqual(1);

    const aceptar = codigo => api().post(`/api/vivo/${raite.id}/solicitudes/${codigo}/aceptar`)
      .set(cond.auth).send({ fecha: FECHA });
    const rechazar = codigo => api().post(`/api/vivo/${raite.id}/solicitudes/${codigo}/rechazar`)
      .set(cond.auth).send({ fecha: FECHA });

    expect((await aceptar(sa.body.codigo)).body.estado).toBe("confirmada");
    expect((await aceptar(sa.body.codigo)).status).toBe(400);
    const sinCupo = await aceptar(sb.body.codigo);
    expect(sinCupo.status).toBe(409);
    expect(sinCupo.body.error.code).toBe("RAITE_LLENO");
    expect((await rechazar(sb.body.codigo)).body.estado).toBe("rechazada");

    expect((await ver(raite.id, a)).body.miReserva.estado).toBe("confirmada");
    expect((await ver(raite.id, b)).body.miReserva).toBeNull();
  });

  it("el avance del auto baja la llegada estimada y finalizar borra la posición", async () => {
    const { cond, raite } = await escenario();
    await api().post(`/api/vivo/${raite.id}/iniciar`).set(cond.auth).send({ fecha: FECHA });
    const p = await nuevoUsuario();
    await solicitar(p, raite.id);
    const { codigo } = await api().get(`/api/vivo/${raite.id}/solicitudes?fecha=${FECHA}`).set(cond.auth)
      .then(r => r.body.solicitudes[0]);
    await api().post(`/api/vivo/${raite.id}/solicitudes/${codigo}/aceptar`).set(cond.auth).send({ fecha: FECHA });

    const ruta = (await ver(raite.id)).body.ruta;
    await mover(cond, raite.id, ruta[0][0], ruta[0][1]);
    const inicio = (await ver(raite.id, p)).body.posicion;
    await mover(cond, raite.id, ruta[ruta.length - 1][0], ruta[ruta.length - 1][1]);
    const fin = (await ver(raite.id, p)).body.posicion;
    expect(fin.etaMin).toBeLessThan(inicio.etaMin);
    expect(fin.distanciaKm).toBeLessThan(inicio.distanciaKm);
    expect(fin.avance).toBeGreaterThan(inicio.avance);
    expect(fin.vigente).toBe(true);

    const aviso = await api().post(`/api/vivo/${raite.id}/avisar`).set(p.auth).send({ fecha: FECHA });
    expect(aviso.status).toBe(200);

    const f = await api().post(`/api/vivo/${raite.id}/finalizar`).set(cond.auth).send({ fecha: FECHA });
    expect(f.body.viaje.estado).toBe("finalizado");
    expect((await ver(raite.id, p)).body.posicion).toBeNull();
    expect((await mover(cond, raite.id, ruta[0][0], ruta[0][1])).status).toBe(400);
  });

  it("responde 409 a solicitudes duplicadas, incluso simultáneas", async () => {
    const { raite } = await escenario();
    const p = await nuevoUsuario();
    const respuestas = await Promise.all([solicitar(p, raite.id), solicitar(p, raite.id)]);
    const estados = respuestas.map(r => r.status).sort();
    expect(estados).toEqual([201, 409]);
    expect(respuestas.find(r => r.status === 409).body.error.code).toBe("SOLICITUD_DUPLICADA");
    expect((await solicitar(p, raite.id)).body.error.code).toBe("SOLICITUD_DUPLICADA");
  });

  it("registra los avisos push del viaje y evita duplicar la proximidad", async () => {
    const { cond, raite } = await escenario();
    const ruta = (await ver(raite.id)).body.ruta;
    const p = await nuevoUsuario();
    const s = await solicitar(p, raite.id);
    const p2 = await nuevoUsuario();
    await solicitar(p2, raite.id);
    const avisos = async auth => (await api()
      .get(`/api/vivo/${raite.id}/notificaciones?fecha=${FECHA}`).set(auth)).body.notificaciones;

    expect((await avisos(cond.auth)).some(n => n.tipo === "solicitud")).toBe(true);
    expect((await api().get(`/api/vivo/${raite.id}/notificaciones?fecha=${FECHA}`).set(p.auth)).status).toBe(403);

    await api().post(`/api/vivo/${raite.id}/solicitudes/${s.body.codigo}/aceptar`)
      .set(cond.auth).send({ fecha: FECHA });
    await api().post(`/api/vivo/${raite.id}/iniciar`).set(cond.auth).send({ fecha: FECHA });
    const cerca = ruta[Math.floor(ruta.length / 3)];
    await mover(cond, raite.id, cerca[0], cerca[1]);
    await mover(cond, raite.id, cerca[0], cerca[1]);
    await api().post(`/api/vivo/${raite.id}/avisar`).set(p.auth).send({ fecha: FECHA });
    await api().post(`/api/vivo/${raite.id}/finalizar`).set(cond.auth).send({ fecha: FECHA });

    const lista = await avisos(cond.auth);
    const tipos = new Set(lista.map(n => n.tipo));
    for (const tipo of ["solicitud", "aceptacion", "inicio", "proximidad", "aviso", "fin"]) {
      expect(tipos.has(tipo), `falta ${tipo}`).toBe(true);
    }
    expect(lista.filter(n => n.tipo === "proximidad")).toHaveLength(1);
    expect(lista.filter(n => n.tipo === "solicitud")).toHaveLength(2);
  });

  it("difunde la posición por WebSocket solo a los participantes", async () => {
    const { cond, raite } = await escenario();
    await api().post(`/api/vivo/${raite.id}/iniciar`).set(cond.auth).send({ fecha: FECHA });
    const p = await nuevoUsuario();
    const s = await solicitar(p, raite.id);
    await api().post(`/api/vivo/${raite.id}/solicitudes/${s.body.codigo}/aceptar`)
      .set(cond.auth).send({ fecha: FECHA });

    expect((await api().post("/api/vivo/ws-ticket")).status).toBe(401);
    const ticket = await api().post("/api/vivo/ws-ticket").set(p.auth);
    expect(ticket.status).toBe(200);
    expect(ticket.body.ticket).toBeTruthy();
    expect(ticket.body.expiraEn).toBe(60);

    const server = createServer(app);
    const wss = attachRealtime(server);
    await new Promise(r => server.listen(0, r));
    const base = `ws://127.0.0.1:${server.address().port}/api/vivo/ws`;
    const ws = new WebSocket(`${base}?token=${encodeURIComponent(ticket.body.ticket)}`);

    const esperar = (tipo, filtro = () => true, ms = 8000) => new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("sin mensaje " + tipo)), ms);
      const oyente = raw => {
        const msg = JSON.parse(raw);
        if (msg.tipo === tipo && filtro(msg)) { clearTimeout(t); ws.off("message", oyente); resolve(msg); }
      };
      ws.on("message", oyente);
    });

    await new Promise(r => ws.on("open", r));
    const listo = esperar("suscrito");
    ws.send(JSON.stringify({ tipo: "suscribir", raiteId: raite.id, fecha: FECHA }));
    const suscrito = await listo;
    expect(suscrito.estado).toBe("en_camino");

    const invalido = esperar("error", m => m.code === "MENSAJE_INVALIDO");
    ws.send(JSON.stringify({ tipo: "posicion", raiteId: raite.id, lat: "no", lng: -98.2 }));
    expect((await invalido).code).toBe("MENSAJE_INVALIDO");

    const ruta = suscrito.ruta || (await ver(raite.id)).body.ruta;
    const aviso = esperar("posicion");
    await mover(cond, raite.id, ruta[0][0], ruta[0][1]);
    const pos = await aviso;
    expect(pos.posicion.lat).toBeCloseTo(ruta[0][0], 4);
    expect(pos.posicion.etaMin).toBeGreaterThan(0);

    // Al cancelar deja de ser participante: el canal en vivo le corta el acceso.
    expect((await api().delete(`/api/reservas/${s.body.codigo}`).set(p.auth)).status).toBe(200);
    const bloqueo = esperar("error", m => m.code === "PROHIBIDO");
    await mover(cond, raite.id, ruta[0][0], ruta[0][1]);
    expect((await bloqueo).code).toBe("PROHIBIDO");

    ws.close();

    // El JWT de sesión sigue funcionando como respaldo para clientes antiguos.
    const jwtWs = new WebSocket(`${base}?token=${encodeURIComponent(cond.token)}`);
    const jwtSuscrito = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("sin suscrito con JWT")), 8000);
      jwtWs.on("message", raw => {
        const m = JSON.parse(raw);
        if (m.tipo === "suscrito") { clearTimeout(t); resolve(m); }
      });
    });
    await new Promise(r => jwtWs.on("open", r));
    jwtWs.send(JSON.stringify({ tipo: "suscribir", raiteId: raite.id, fecha: FECHA }));
    expect((await jwtSuscrito).estado).toBe("en_camino");
    jwtWs.close();

    // El ticket solo identifica: si la cuenta ya no existe, el canal responde 401.
    const efimero = await nuevoUsuario();
    const ticketEfimero = await api().post("/api/vivo/ws-ticket").set(efimero.auth);
    await query("DELETE FROM users WHERE id = $1", [efimero.usuario.id]);
    const muerto = new WebSocket(`${base}?token=${encodeURIComponent(ticketEfimero.body.ticket)}`);
    const estadoHttp = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("sin respuesta 401 del WebSocket")), 8000);
      muerto.on("unexpected-response", (req, res) => {
        clearTimeout(t);
        res.resume();
        resolve(res.statusCode);
      });
      muerto.on("open", () => { clearTimeout(t); muerto.close(); reject(new Error("el WebSocket aceptó una cuenta eliminada")); });
      muerto.on("error", () => {});
    });
    expect(estadoHttp).toBe(401);

    await new Promise(r => server.close(r));
    wss.close();
  });
});
