/**
 * Piezas de validación reutilizables (zod): correo institucional, hora, día,
 * y coerción de booleanos/enteros que llegan como texto en la query string.
 */
import { z } from "zod";

export const correoUtp = z.string().trim().toLowerCase()
  .regex(/^[^\s@]+@utpuebla\.edu\.mx$/, "Usa tu correo institucional @utpuebla.edu.mx");
export const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM)");
export const dia = z.coerce.number().int().min(0).max(5);
export const idParam = z.object({ id: z.coerce.number().int().positive() });
export const boolQuery = z.enum(["true", "false"]).transform(v => v === "true");
