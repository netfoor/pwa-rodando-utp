import { describe, it, expect } from "vitest";
import { api } from "./helpers.js";

describe("health y catálogo", () => {
  it("GET /api/health responde ok con db", async () => {
    const res = await api().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", db: true });
    expect(res.body.uptime).toBeTypeOf("number");
  });

  it("GET /api/zonas devuelve las 8 zonas en orden original", async () => {
    const res = await api().get("/api/zonas");
    expect(res.body.zonas).toHaveLength(8);
    expect(res.body.zonas[0]).toMatchObject({ id: "centro", km: 8, color: "#FF8A3D" });
    expect(res.body.zonas[0].trazo).toMatch(/^M255 235/);
  });

  it("GET /api/zonas/:id y 404 uniforme", async () => {
    expect((await api().get("/api/zonas/cholula")).body.nombre).toBe("Cholula");
    const nf = await api().get("/api/zonas/nada");
    expect(nf.status).toBe(404);
    expect(nf.body.error).toMatchObject({ code: "NO_ENCONTRADO" });
  });

  it("testimonios, faq, config y stats", async () => {
    expect((await api().get("/api/testimonios")).body.testimonios).toHaveLength(4);
    expect((await api().get("/api/faq")).body.faq).toHaveLength(5);
    const cfg = (await api().get("/api/config")).body;
    expect(cfg).toMatchObject({ precioGasolina: 24.3, co2PorLitro: 2.31, tarifaUberKm: 9.5, tarifaUberBase: 35, pasajeTransporte: 12 });
    expect(cfg.stats_estudiantes).toBeUndefined();
    const st = (await api().get("/api/stats")).body;
    expect(st.estudiantes).toBeGreaterThanOrEqual(1240);
    expect(st.conductores).toBeGreaterThanOrEqual(318);
  });

  it("ruta /api desconocida devuelve error uniforme", async () => {
    const res = await api().get("/api/inexistente");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NO_ENCONTRADO");
  });
});

describe("calculadora", () => {
  it("modo conductor replica la fórmula original", async () => {
    // km=8, dias=5, 3 pasajeros, 14 km/L, $24.3
    const res = await api().post("/api/calculadora").send({ rol: "conductor", km: 8, dias: 5, pasajeros: 3, rendimiento: 14, precio: 24.3 });
    expect(res.status).toBe(200);
    const litros = (8 * 2 * 5 * 4.3) / 14, gas = litros * 24.3;
    expect(res.body.ahorroMes).toBeCloseTo(gas - gas / 4, 6);
    expect(res.body.ahorroCuatri).toBeCloseTo((gas - gas / 4) * 4, 6);
    expect(res.body.litros).toBeCloseTo(litros * 3, 6);
    expect(res.body.co2Kg).toBeCloseTo(litros * 3 * 2.31, 6);
    expect(res.body.asientos).toBeCloseTo(3 * 5 * 2 * 4.3, 6);
    expect(res.body.barras).toHaveLength(2);
  });

  it("modo pasajero compara con Uber y transporte público", async () => {
    const res = await api().post("/api/calculadora").send({ rol: "pasajero", km: 17, dias: 5 });
    const viajes = 5 * 2 * 4.3, gas = ((17 * 2 * 5 * 4.3) / 14) * 24.3;
    const uber = viajes * (35 + 17 * 9.5);
    expect(res.body.ahorroMes).toBeCloseTo(uber - gas / 4, 6);
    expect(res.body.horas).toBeCloseTo(viajes * 0.6, 6);
    expect(res.body.barras.map(b => b.label)[1]).toBe("Transporte público (3 camiones)");
    expect(res.body.barras[1].val).toBeCloseTo(viajes * 12 * 3, 6);
  });

  it("valida la entrada", async () => {
    const res = await api().post("/api/calculadora").send({ rol: "piloto", km: 500, dias: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDACION");
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});
