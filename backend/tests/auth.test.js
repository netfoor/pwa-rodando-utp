import { describe, it, expect } from "vitest";
import { api, nuevoUsuario, loginAdmin } from "./helpers.js";

describe("auth", () => {
  it("registra, inicia sesión y consulta /me", async () => {
    const u = await nuevoUsuario({ carrera: "Mecatrónica", cuatrimestre: 4 });
    expect(u.usuario).toMatchObject({ rol: "pasajero", carrera: "Mecatrónica" });
    expect(u.usuario.password_hash).toBeUndefined();

    const login = await api().post("/api/auth/login").send({ correo: u.usuario.correo, password: "Prueba1234" });
    expect(login.status).toBe(200);
    const me = await api().get("/api/auth/me").set("Authorization", `Bearer ${login.body.token}`);
    expect(me.body.usuario.correo).toBe(u.usuario.correo);
  });

  it("solo acepta correos @utpuebla.edu.mx", async () => {
    const res = await api().post("/api/auth/registro").send({ nombre: "Alguien Más", correo: "x@gmail.com", password: "Prueba1234" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDACION");
  });

  it("rechaza correo duplicado y contraseñas incorrectas", async () => {
    const u = await nuevoUsuario();
    const dup = await api().post("/api/auth/registro").send({ nombre: "Otra Persona", correo: u.usuario.correo, password: "Prueba1234" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("CORREO_EXISTENTE");
    const mal = await api().post("/api/auth/login").send({ correo: u.usuario.correo, password: "incorrecta" });
    expect(mal.status).toBe(401);
    expect(mal.body.error.code).toBe("CREDENCIALES_INVALIDAS");
  });

  it("/me exige token válido", async () => {
    expect((await api().get("/api/auth/me")).status).toBe(401);
    expect((await api().get("/api/auth/me").set("Authorization", "Bearer basura")).status).toBe(401);
  });

  it("un conductor debe indicar su coche", async () => {
    const res = await api().post("/api/auth/registro").send({ nombre: "Sin Coche", correo: `sc${Date.now()}@utpuebla.edu.mx`, password: "Prueba1234", rol: "conductor" });
    expect(res.status).toBe(400);
  });
});

describe("solicitudes de conductor y admin", () => {
  it("flujo: solicitud pública → admin la lista y aprueba", async () => {
    const correo = `solic${Date.now()}@utpuebla.edu.mx`;
    const alumno = await nuevoUsuario({ correo });
    const sol = await api().post("/api/conductores/solicitud")
      .send({ nombre: "Nuevo Conductor", correo, auto: "Versa gris", zona: "cu", hora: "06:15", lugares: 3 });
    expect(sol.status).toBe(201);
    expect(sol.body.aportacionSugerida).toBe(20); // 12 km * 1.8 = 21.6 -> 20

    expect((await api().get("/api/admin/solicitudes").set(alumno.auth)).status).toBe(403);
    const admin = await loginAdmin();
    const lista = await api().get("/api/admin/solicitudes?estado=pendiente").set(admin);
    expect(lista.body.solicitudes.some(s => s.id === sol.body.id)).toBe(true);

    const ap = await api().post(`/api/admin/solicitudes/${sol.body.id}/aprobar`).set(admin);
    expect(ap.body).toMatchObject({ estado: "aprobada", usuarioExiste: true });
    expect((await api().get(`/api/raites/${ap.body.raiteId}`)).body.zona).toBe("cu");
    expect((await api().post(`/api/admin/solicitudes/${sol.body.id}/aprobar`).set(admin)).status).toBe(409);
  });

  it("rechaza solicitudes con correo no institucional", async () => {
    const res = await api().post("/api/conductores/solicitud")
      .send({ nombre: "Nuevo Conductor", correo: "a@hotmail.com", auto: "Versa gris", zona: "cu", hora: "06:15" });
    expect(res.status).toBe(400);
  });
});

describe("push", () => {
  it("sin llaves VAPID la llave pública responde 503 uniforme", async () => {
    const res = await api().get("/api/push/vapid-public-key");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("PUSH_NO_CONFIGURADO");
  });

  it("guarda suscripciones y exige admin para enviar", async () => {
    const sub = { endpoint: "https://push.example.com/abc" + Date.now(), keys: { p256dh: "k", auth: "a" } };
    expect((await api().post("/api/push/subscribe").send(sub)).status).toBe(201);
    const u = await nuevoUsuario();
    expect((await api().post("/api/push/send").set(u.auth).send({ titulo: "t", mensaje: "m" })).status).toBe(403);
    const ok = await api().post("/api/push/send").set(await loginAdmin()).send({ titulo: "t", mensaje: "m" });
    expect(ok.status).toBe(200);
  });
});
