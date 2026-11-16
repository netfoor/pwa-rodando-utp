import { describe, it, expect } from "vitest";
import { api, nuevoUsuario } from "./helpers.js";

async function raitePropio(asientos = 3) {
  const cond = await nuevoUsuario({ rol: "conductor", auto: "Auto de prueba" });
  const res = await api().post("/api/raites").set(cond.auth)
    .send({ zona: "centro", tipo: "ida", hora: "06:00", dias: [0, 1, 2], asientos, aportacion: 10, paradas: ["Zócalo", "Paseo Bravo"] });
  return { cond, raite: res.body };
}

describe("ritmo", () => {
  it("detecta el patrón a partir de las reservas y sugiere un raite", async () => {
    const { raite } = await raitePropio();
    const u = await nuevoUsuario();
    for (const dia of [0, 1]) {
      await api().post("/api/reservas").set(u.auth).send({ raiteId: raite.id, dia, parada: "Zócalo", nombre: "Alumno" });
    }
    const res = await api().get("/api/ritmo/patron").set(u.auth);
    expect(res.status).toBe(200);
    expect(res.body.viajes).toBe(2);
    expect(res.body.patrones[0]).toMatchObject({ zonaId: "centro", tipo: "ida", franja: "06:00", dias: [0, 1] });
    expect(res.body.sugerencia.diasCubiertos).toEqual([0, 1]);
    expect((await api().get("/api/ritmo/patron")).status).toBe(401);
  });

  it("confirma un grupo, genera las reservas de cada día y no duplica las existentes", async () => {
    const { raite } = await raitePropio();
    const u = await nuevoUsuario();
    await api().post("/api/reservas").set(u.auth).send({ raiteId: raite.id, dia: 0, parada: "Zócalo", nombre: "Alumno" });
    const res = await api().post("/api/ritmo/grupos").set(u.auth).send({ raiteId: raite.id, dias: [0, 1, 2], parada: "Zócalo" });
    expect(res.status).toBe(201);
    expect(res.body.reservas.map(r => r.nueva)).toEqual([false, true, true]);
    expect((await api().get("/api/reservas/mias").set(u.auth)).body.reservas).toHaveLength(3);
    const otra = await api().post("/api/ritmo/grupos").set(u.auth).send({ raiteId: raite.id, dias: [0], parada: "Zócalo" });
    expect(otra.status).toBe(409);
    const mios = await api().get("/api/ritmo/grupos").set(u.auth);
    expect(mios.body.grupos[0]).toMatchObject({ raiteId: raite.id, aportacionSemanal: 30 });
  });

  it("rechaza días fuera del raite, cupo agotado y datos inválidos", async () => {
    const { raite } = await raitePropio(1);
    const a = await nuevoUsuario(), b = await nuevoUsuario();
    expect((await api().post("/api/ritmo/grupos").set(a.auth).send({ raiteId: raite.id, dias: [4], parada: "Zócalo" })).status).toBe(400);
    expect((await api().post("/api/ritmo/grupos").set(a.auth).send({ raiteId: raite.id, dias: [0, 0], parada: "Zócalo" })).status).toBe(400);
    expect((await api().post("/api/ritmo/grupos").set(a.auth).send({ raiteId: raite.id, dias: [0, 1], parada: "Zócalo" })).status).toBe(201);
    const lleno = await api().post("/api/ritmo/grupos").set(b.auth).send({ raiteId: raite.id, dias: [1], parada: "Zócalo" });
    expect(lleno.status).toBe(409);
    expect(lleno.body.error.code).toBe("RAITE_LLENO");
  });

  it("registra ausencias solo en días del grupo y al salir cancela las reservas", async () => {
    const { raite } = await raitePropio();
    const u = await nuevoUsuario(), otro = await nuevoUsuario();
    const g = (await api().post("/api/ritmo/grupos").set(u.auth).send({ raiteId: raite.id, dias: [0, 1], parada: "Zócalo" })).body.grupo;
    expect((await api().post(`/api/ritmo/grupos/${g.id}/ausencias`).set(u.auth).send({ fecha: "2026-11-16" })).status).toBe(201); // lunes
    expect((await api().post(`/api/ritmo/grupos/${g.id}/ausencias`).set(u.auth).send({ fecha: "2026-11-18" })).status).toBe(400); // miércoles
    expect((await api().post(`/api/ritmo/grupos/${g.id}/ausencias`).set(otro.auth).send({ fecha: "2026-11-17" })).status).toBe(403);
    const fuera = await api().delete(`/api/ritmo/grupos/${g.id}`).set(u.auth);
    expect(fuera.body.reservasCanceladas).toBe(2);
    expect((await api().get("/api/reservas/mias").set(u.auth)).body.reservas).toHaveLength(0);
  });

  it("publica la demanda por zona, sentido y hora", async () => {
    const res = await api().get("/api/ritmo/demanda");
    expect(res.status).toBe(200);
    expect(res.body.demanda.length).toBeGreaterThan(0);
    expect(res.body.demanda[0]).toHaveProperty("ocupacion");
  });
});
