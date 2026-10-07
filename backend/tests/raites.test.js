import { describe, it, expect } from "vitest";
import { api, nuevoUsuario } from "./helpers.js";

describe("GET /api/raites", () => {
  it("devuelve los 16 raites con conductor, auto, paradas y libres", async () => {
    const res = await api().get("/api/raites");
    expect(res.body.total).toBeGreaterThanOrEqual(16);
    const r1 = res.body.raites.find(r => r.id === 1);
    expect(r1).toMatchObject({ zona: "centro", tipo: "ida", hora: "06:20", asientos: 4, aportacion: 25, auto: "Nissan March gris", libres: 2 });
    expect(r1.conductor).toMatchObject({ nombre: "Mariana López", rating: 4.9, viajes: 132 });
    expect(r1.paradas).toEqual(["Zócalo", "Paseo Bravo", "Blvd. 5 de Mayo"]);
  });

  it("filtra por zona, tipo y turno", async () => {
    const z = await api().get("/api/raites?zona=amozoc");
    expect(z.body.raites.every(r => r.zona === "amozoc")).toBe(true);
    expect(z.body.total).toBe(2);
    const t = await api().get("/api/raites?zona=amozoc&tipo=regreso");
    expect(t.body.raites.map(r => r.id)).toEqual([6]);
    const m = await api().get("/api/raites?turno=manana");
    expect(m.body.raites.every(r => parseInt(r.hora) < 12)).toBe(true);
    const v = await api().get("/api/raites?turno=vespertino");
    expect(v.body.raites.every(r => parseInt(r.hora) >= 12)).toBe(true);
    const n = await api().get("/api/raites?turno=noche");
    expect(n.body.raites.every(r => parseInt(r.hora) >= 18)).toBe(true);
    expect(n.body.total).toBeGreaterThan(0);
  });

  it("libres=true excluye raites llenos; dia filtra los que salen ese día", async () => {
    // El raite 9 (Angelópolis regreso, 4 asientos, 3 ocupados) y el 16 (3/3 ocupados) -> 16 está lleno
    const res = await api().get("/api/raites?libres=true");
    expect(res.body.raites.find(r => r.id === 16)).toBeUndefined();
    expect(res.body.raites.every(r => r.libres > 0)).toBe(true);
    const sab = await api().get("/api/raites?dia=5");
    expect(sab.body.raites.map(r => r.id).sort((a, b) => a - b)).toEqual([4, 11]);
  });

  it("rechaza filtros inválidos", async () => {
    expect((await api().get("/api/raites?turno=madrugada")).status).toBe(400);
  });

  it("GET /api/raites/:id", async () => {
    expect((await api().get("/api/raites/7")).body.dias).toEqual([0, 2, 4]);
    expect((await api().get("/api/raites/9999")).status).toBe(404);
  });
});

describe("CRUD de raites (conductor dueño)", () => {
  it("un conductor crea, edita y borra su raite; otro no puede tocarlo", async () => {
    const dueno = await nuevoUsuario({ rol: "conductor", auto: "Tsuru verde" });
    const otro = await nuevoUsuario({ rol: "conductor", auto: "March rojo" });
    const datos = { zona: "croc", tipo: "ida", hora: "07:00", dias: [0, 1], asientos: 3, aportacion: 15, paradas: ["Unidad CROC"] };

    const creado = await api().post("/api/raites").set(dueno.auth).send(datos);
    expect(creado.status).toBe(201);
    expect(creado.body).toMatchObject({ auto: "Tsuru verde", libres: 3 });
    const id = creado.body.id;

    expect((await api().patch(`/api/raites/${id}`).set(otro.auth).send({ aportacion: 1 })).status).toBe(403);
    const ed = await api().patch(`/api/raites/${id}`).set(dueno.auth).send({ aportacion: 20 });
    expect(ed.body.aportacion).toBe(20);
    expect((await api().delete(`/api/raites/${id}`).set(otro.auth)).status).toBe(403);
    expect((await api().delete(`/api/raites/${id}`).set(dueno.auth)).status).toBe(204);
    expect((await api().get(`/api/raites/${id}`)).status).toBe(404);
  });

  it("un pasajero no puede publicar raites y sin sesión es 401", async () => {
    const p = await nuevoUsuario();
    const datos = { zona: "croc", tipo: "ida", hora: "07:00", dias: [0], asientos: 3, aportacion: 15, paradas: ["Unidad CROC"] };
    expect((await api().post("/api/raites").set(p.auth).send(datos)).status).toBe(403);
    expect((await api().post("/api/raites").send(datos)).status).toBe(401);
  });
});
