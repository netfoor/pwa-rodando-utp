import { describe, it, expect } from "vitest";
import { api, nuevoUsuario, loginAdmin } from "./helpers.js";

describe("caché de la API", () => {
  it("la primera lectura es MISS y la segunda HIT con el mismo cuerpo", async () => {
    await api().delete("/api/cache").set(await loginAdmin());
    const a = await api().get("/api/zonas");
    const b = await api().get("/api/zonas");
    expect(a.headers["x-cache"]).toBe("MISS");
    expect(b.headers["x-cache"]).toBe("HIT");
    expect(b.body).toEqual(a.body);
    expect(b.headers.age).toBeDefined();
  });

  it("responde 304 si el navegador manda el ETag vigente", async () => {
    const a = await api().get("/api/faq");
    const b = await api().get("/api/faq").set("If-None-Match", a.headers.etag);
    expect(b.status).toBe(304);
  });

  it("una escritura invalida la caché (los lugares libres no quedan viejos)", async () => {
    const c = await nuevoUsuario({ rol: "conductor", auto: "Auto caché" });
    const r = await api().post("/api/raites").set(c.auth)
      .send({ zona: "centro", tipo: "ida", hora: "06:00", dias: [0], asientos: 2, aportacion: 10, paradas: ["Zócalo"] });
    const antes = await api().get(`/api/raites?zona=centro`);
    expect((await api().get(`/api/raites?zona=centro`)).headers["x-cache"]).toBe("HIT");
    expect(antes.body.raites.find(x => x.id === r.body.id).libres).toBe(2);

    const u = await nuevoUsuario();
    await api().post("/api/reservas").set(u.auth).send({ raiteId: r.body.id, dia: 0, parada: "Zócalo", nombre: "Alumno Caché" });
    const despues = await api().get(`/api/raites?zona=centro`);
    expect(despues.headers["x-cache"]).toBe("MISS");
    expect(despues.body.raites.find(x => x.id === r.body.id).libres).toBe(1);
  });

  it("/api/cache/stats muestra contadores y DELETE /api/cache exige admin", async () => {
    const s = await api().get("/api/cache/stats");
    expect(s.body).toMatchObject({ entradas: expect.any(Number), hits: expect.any(Number), misses: expect.any(Number) });
    expect((await api().delete("/api/cache")).status).toBe(401);
    const ok = await api().delete("/api/cache").set(await loginAdmin());
    expect(ok.body.entradas).toBe(0);
  });
});
