import { describe, it, expect } from "vitest";
import { api, nuevoUsuario } from "./helpers.js";

/** Crea un raite propio (conductor nuevo) con N asientos para aislar la prueba del seed. */
async function raitePropio(asientos) {
  const cond = await nuevoUsuario({ rol: "conductor", auto: "Auto de prueba" });
  const res = await api().post("/api/raites").set(cond.auth)
    .send({ zona: "centro", tipo: "ida", hora: "06:00", dias: [0, 1], asientos, aportacion: 10, paradas: ["Zócalo", "Paseo Bravo"] });
  return { cond, raite: res.body };
}
const apartar = (u, raiteId, extra = {}) =>
  api().post("/api/reservas").set(u.auth).send({ raiteId, dia: 0, parada: "Zócalo", nombre: "Alumno Prueba", ...extra });

describe("reservas", () => {
  it("aparta, aparece en /mias, baja libres y se cancela", async () => {
    const { raite } = await raitePropio(2);
    const u = await nuevoUsuario();

    const res = await apartar(u, raite.id);
    expect(res.status).toBe(201);
    expect(res.body.codigo).toMatch(/^RU-[A-Z0-9]{4}$/);
    expect((await api().get(`/api/raites/${raite.id}?`)).body.libresPorDia["0"]).toBe(1);

    const mias = await api().get("/api/reservas/mias").set(u.auth);
    expect(mias.body.reservas).toHaveLength(1);
    expect(mias.body.reservas[0]).toMatchObject({ codigo: res.body.codigo, hora: "06:00", zona: "centro" });

    const cancel = await api().delete(`/api/reservas/${res.body.codigo}`).set(u.auth);
    expect(cancel.body.estado).toBe("cancelada");
    expect((await api().get("/api/reservas/mias").set(u.auth)).body.reservas).toHaveLength(0);
    expect((await api().get(`/api/raites/${raite.id}`)).body.libresPorDia["0"]).toBe(2);
  });

  it("exige sesión, no permite reservar dos veces ni en día/parada inválidos", async () => {
    const { raite } = await raitePropio(3);
    const u = await nuevoUsuario();
    expect((await api().post("/api/reservas").send({ raiteId: raite.id, dia: 0, parada: "Zócalo", nombre: "X Y" })).status).toBe(401);
    expect((await apartar(u, raite.id)).status).toBe(201);
    const dup = await apartar(u, raite.id);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("RESERVA_DUPLICADA");
    expect((await apartar(u, raite.id, { dia: 3 })).status).toBe(400);   // el raite no sale ese día
    expect((await apartar(u, raite.id, { dia: 1, parada: "Narnia" })).status).toBe(400);
  });

  it("el conductor no puede apartar en su propio raite", async () => {
    const { cond, raite } = await raitePropio(2);
    expect((await apartar(cond, raite.id)).status).toBe(400);
  });

  it("no se puede cancelar la reservación de otra persona", async () => {
    const { raite } = await raitePropio(2);
    const a = await nuevoUsuario(), b = await nuevoUsuario();
    const r = await apartar(a, raite.id);
    expect((await api().delete(`/api/reservas/${r.body.codigo}`).set(b.auth)).status).toBe(403);
    expect((await api().delete("/api/reservas/RU-ZZZZ").set(b.auth)).status).toBe(404);
  });

  it("rechaza con RAITE_LLENO cuando se agotan los lugares", async () => {
    const { raite } = await raitePropio(1);
    const a = await nuevoUsuario(), b = await nuevoUsuario();
    expect((await apartar(a, raite.id)).status).toBe(201);
    const lleno = await apartar(b, raite.id);
    expect(lleno.status).toBe(409);
    expect(lleno.body.error.code).toBe("RAITE_LLENO");
    // otro día sigue libre
    expect((await apartar(b, raite.id, { dia: 1 })).status).toBe(201);
  });

  it("concurrencia: 8 solicitudes simultáneas por 3 lugares → exactamente 3 éxitos (sin sobreventa)", async () => {
    const { raite } = await raitePropio(3);
    const usuarios = await Promise.all(Array.from({ length: 8 }, () => nuevoUsuario()));
    const resultados = await Promise.all(usuarios.map(u => apartar(u, raite.id)));
    const ok = resultados.filter(r => r.status === 201);
    const llenos = resultados.filter(r => r.status === 409 && r.body.error.code === "RAITE_LLENO");
    expect(ok).toHaveLength(3);
    expect(llenos).toHaveLength(5);
    expect(new Set(ok.map(r => r.body.codigo)).size).toBe(3);
    expect((await api().get(`/api/raites/${raite.id}`)).body.libresPorDia["0"]).toBe(0);
  });
});
