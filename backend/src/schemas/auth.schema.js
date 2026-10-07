/**
 * Esquemas de entrada para registro e inicio de sesión.
 */
import { z } from "zod";
import { correoUtp } from "./common.js";

export const registroSchema = z.object({
  nombre: z.string().trim().min(3, "Escribe tu nombre completo").max(80),
  correo: correoUtp,
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
  rol: z.enum(["pasajero", "conductor"]).default("pasajero"),
  carrera: z.string().trim().max(80).optional(),
  cuatrimestre: z.coerce.number().int().min(1).max(11).optional(),
  auto: z.string().trim().min(3).max(60).optional(),
  placas: z.string().trim().max(12).optional()
}).refine(d => d.rol !== "conductor" || d.auto, { path: ["auto"], message: "Los conductores deben indicar su coche" });

export const loginSchema = z.object({
  correo: correoUtp,
  password: z.string().min(1, "Escribe tu contraseña")
});
