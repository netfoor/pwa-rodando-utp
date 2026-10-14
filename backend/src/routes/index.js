/**
 * Tabla de rutas de la API (/api/*). Cada ruta declara su validación (zod),
 * su nivel de acceso (público, sesión o rol) y el controlador que la atiende.
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../middlewares/validate.js";
import { requireAuth, optionalAuth, requireRole } from "../middlewares/auth.js";
import { asyncHandler as h } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { idParam } from "../schemas/common.js";
import { registroSchema, loginSchema } from "../schemas/auth.schema.js";
import { listarRaitesQuery, crearRaiteSchema, editarRaiteSchema } from "../schemas/raites.schema.js";
import { crearReservaSchema, codigoParam } from "../schemas/reservas.schema.js";
import { calculadoraSchema, solicitudConductorSchema, suscripcionSchema, enviarPushSchema } from "../schemas/otros.schema.js";
import * as auth from "../controllers/auth.controller.js";
import * as cat from "../controllers/catalogo.controller.js";
import * as raites from "../controllers/raites.controller.js";
import * as reservas from "../controllers/reservas.controller.js";
import * as cond from "../controllers/conductores.controller.js";
import * as adminCtl from "../controllers/admin.controller.js";
import { rolUsuarioSchema } from "../schemas/admin.schema.js";
import * as push from "../controllers/push.controller.js";
import { health } from "../controllers/health.controller.js";

// Límite estricto para login/registro (fuerza bruta); se desactiva en pruebas.
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  skip: () => env.isTest,
  handler: (req, res) => res.status(429).json({ error: { code: "DEMASIADAS_PETICIONES", message: "Demasiados intentos, espera unos minutos" } })
});

const r = Router();

r.get("/health", h(health));

r.post("/auth/registro", limiteAuth, validate({ body: registroSchema }), h(auth.registro));
r.post("/auth/login", limiteAuth, validate({ body: loginSchema }), h(auth.login));
r.get("/auth/me", requireAuth, h(auth.me));

r.get("/zonas", h(cat.zonas));
r.get("/zonas/:id", h(cat.zona));

r.get("/raites", validate({ query: listarRaitesQuery }), h(raites.listar));
r.get("/raites/mios", requireAuth, h(raites.mios)); // antes de :id para que no se confunda
r.get("/raites/:id", validate({ params: idParam }), h(raites.detalle));
r.post("/raites", ...requireRole("conductor", "admin"), validate({ body: crearRaiteSchema }), h(raites.crear));
r.patch("/raites/:id", requireAuth, validate({ params: idParam, body: editarRaiteSchema }), h(raites.actualizar));
r.delete("/raites/:id", requireAuth, validate({ params: idParam }), h(raites.eliminar));

r.post("/reservas", requireAuth, validate({ body: crearReservaSchema }), h(reservas.crear));
r.get("/reservas/mias", requireAuth, h(reservas.mias));
r.delete("/reservas/:codigo", requireAuth, validate({ params: codigoParam }), h(reservas.cancelar));

r.post("/conductores/solicitud", validate({ body: solicitudConductorSchema }), h(cond.solicitud));
r.get("/admin/solicitudes", ...requireRole("admin"), h(cond.listar));
r.post("/admin/solicitudes/:id/aprobar", ...requireRole("admin"), validate({ params: idParam }), h(cond.aprobar));

// Panel de administración (solo admin). Las rutas fijas van antes de /admin/:recurso.
const soloAdmin = requireRole("admin");
r.get("/admin/resumen", ...soloAdmin, h(adminCtl.resumen));
r.get("/admin/usuarios", ...soloAdmin, h(adminCtl.usuarios));
r.patch("/admin/usuarios/:id", ...soloAdmin, validate({ params: idParam, body: rolUsuarioSchema }), h(adminCtl.cambiarRol));
r.delete("/admin/usuarios/:id", ...soloAdmin, validate({ params: idParam }), h(adminCtl.eliminarUsuario));
r.get("/admin/reservas", ...soloAdmin, h(adminCtl.reservas));
r.get("/admin/raites", ...soloAdmin, h(adminCtl.raites));
r.get("/admin/:recurso", ...soloAdmin, h(adminCtl.listarRecurso));          // zonas | testimonios | faq
r.post("/admin/:recurso", ...soloAdmin, h(adminCtl.crearRecurso));
r.patch("/admin/:recurso/:id", ...soloAdmin, h(adminCtl.actualizarRecurso));
r.delete("/admin/:recurso/:id", ...soloAdmin, h(adminCtl.eliminarRecurso));

r.get("/stats", h(cat.stats));
r.get("/testimonios", h(cat.testimonios));
r.get("/faq", h(cat.faq));
r.get("/config", h(cat.config));
r.post("/calculadora", validate({ body: calculadoraSchema }), h(cat.calculadora));

r.get("/push/vapid-public-key", h(push.llavePublica));
r.post("/push/subscribe", optionalAuth, validate({ body: suscripcionSchema }), h(push.suscribir));
r.post("/push/send", ...requireRole("admin"), validate({ body: enviarPushSchema }), h(push.enviar));

export default r;
