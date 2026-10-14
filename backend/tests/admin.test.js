import { describe, it, expect } from "vitest";
import { api, nuevoUsuario, loginAdmin } from "./helpers.js";

describe("panel de administración", () => {
  it("solo el admin accede", async () => {
    const u = await nuevoUsuario();
    expect((await api().get("/api/admin/resumen")).status).toBe(401);
    expect((await api().get("/api/admin/zonas").set(u.auth)).status).toBe(403);
  });

  it("CRUD de zonas, con 409 si está en uso", async () => {
    const admin = await loginAdmin();
    const z = { id: "zona-prueba", nombre: "Zona de Prueba", km: 11, x: 100, y: 100, color: "#112233", trazo_svg: "M100 100 C 200 120, 300 130 440 140" };
    expect((await api().post("/api/admin/zonas").set(admin).send(z)).status).toBe(201);
    expect((await api().post("/api/admin/zonas").set(admin).send(z)).status).toBe(409);        // id repetido
    expect((await api().post("/api/admin/zonas").set(admin).send({ ...z, id: "x", color: "rojo" })).status).toBe(400);
    const ed = await api().patch("/api/admin/zonas/zona-prueba").set(admin).send({ nombre: "Renombrada", km: 12 });
    expect(ed.body).toMatchObject({ nombre: "Renombrada", km: 12 });
    expect((await api().get("/api/zonas")).body.zonas.some(x => x.id === "zona-prueba")).toBe(true);
    expect((await api().delete("/api/admin/zonas/zona-prueba").set(admin)).status).toBe(204);
    const enUso = await api().delete("/api/admin/zonas/centro").set(admin);
    expect(enUso.status).toBe(409);
    expect(enUso.body.error.code).toBe("EN_USO");
  });

  it("CRUD de testimonios y FAQ", async () => {
    const admin = await loginAdmin();
    const t = await api().post("/api/admin/testimonios").set(admin).send({ texto: "Muy buena plataforma para ir a la UTP", nombre: "Prueba P.", rol: "Pasajero · Test" });
    expect(t.status).toBe(201);
    expect((await api().patch(`/api/admin/testimonios/${t.body.id}`).set(admin).send({ nombre: "Cambiado" })).body.nombre).toBe("Cambiado");
    expect((await api().delete(`/api/admin/testimonios/${t.body.id}`).set(admin)).status).toBe(204);
    expect((await api().delete(`/api/admin/testimonios/${t.body.id}`).set(admin)).status).toBe(404);

    const f = await api().post("/api/admin/faq").set(admin).send({ pregunta: "¿Pregunta de prueba?", respuesta: "Respuesta de prueba" });
    expect(f.status).toBe(201);
    expect((await api().get("/api/faq")).body.faq.some(x => x.pregunta === "¿Pregunta de prueba?")).toBe(true);
    expect((await api().delete(`/api/admin/faq/${f.body.id}`).set(admin)).status).toBe(204);
    expect((await api().get("/api/admin/inexistente").set(admin)).status).toBe(404);
  });

  it("usuarios: cambiar rol y eliminar; vistas globales y resumen", async () => {
    const admin = await loginAdmin();
    const u = await nuevoUsuario();
    const r = await api().patch(`/api/admin/usuarios/${u.usuario.id}`).set(admin).send({ rol: "conductor" });
    expect(r.body.rol).toBe("conductor");
    expect((await api().get("/api/admin/usuarios").set(admin)).body.items.some(x => x.id === u.usuario.id)).toBe(true);
    expect((await api().delete(`/api/admin/usuarios/${u.usuario.id}`).set(admin)).status).toBe(204);
    expect((await api().get("/api/admin/reservas").set(admin)).body.items.length).toBeGreaterThan(0);
    expect((await api().get("/api/admin/raites").set(admin)).body.items.length).toBeGreaterThanOrEqual(16);
    expect((await api().get("/api/admin/resumen").set(admin)).body).toMatchObject({ zonas: 8, testimonios: 4, faq: 5 });
  });
});
