/**
 * Esquemas de entrada de calculadora, solicitud de conductor y notificaciones push.
 */
import { z } from "zod";
import { correoUtp, hora } from "./common.js";

export const calculadoraSchema = z.object({
  rol: z.enum(["conductor", "pasajero"]),
  km: z.number().min(1).max(40),
  dias: z.number().int().min(1).max(6),
  pasajeros: z.number().int().min(1).max(4).default(3),
  rendimiento: z.number().min(6).max(25).default(14),
  precio: z.number().min(10).max(40).optional()
});

export const solicitudConductorSchema = z.object({
  nombre: z.string().trim().min(3).max(80).refine(n => n.split(/\s+/).length >= 2, "Escribe tu nombre y apellido"),
  correo: correoUtp,
  carrera: z.string().trim().max(80).optional(),
  auto: z.string().trim().min(3).max(60),
  zona: z.string().trim().min(1),
  hora,
  lugares: z.number().int().min(1).max(4).default(3)
});

export const suscripcionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) })
});

export const enviarPushSchema = z.object({
  titulo: z.string().trim().min(1).max(80),
  mensaje: z.string().trim().min(1).max(200),
  userId: z.number().int().positive().optional()
});
