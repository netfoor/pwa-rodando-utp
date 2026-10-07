/**
 * Esquemas de entrada de raites: filtros de listado (query), creación y edición.
 */
import { z } from "zod";
import { hora, dia, boolQuery } from "./common.js";

export const listarRaitesQuery = z.object({
  zona: z.string().trim().min(1).optional(),
  // matutino/vespertino son los valores que usa la interfaz (antes/después de las 12:00).
  turno: z.enum(["manana", "tarde", "noche", "matutino", "vespertino"]).optional(),
  tipo: z.enum(["ida", "regreso"]).optional(),
  libres: boolQuery.optional(),
  dia: dia.optional()
});

const dias = z.array(z.number().int().min(0).max(5)).min(1).max(6)
  .transform(a => [...new Set(a)].sort((x, y) => x - y));

export const crearRaiteSchema = z.object({
  zona: z.string().trim().min(1),
  tipo: z.enum(["ida", "regreso"]),
  hora,
  dias,
  asientos: z.number().int().min(1).max(8),
  aportacion: z.number().int().min(0).max(500),
  paradas: z.array(z.string().trim().min(2).max(60)).min(1).max(6)
});

export const editarRaiteSchema = crearRaiteSchema.partial().extend({ activo: z.boolean().optional() })
  .refine(d => Object.keys(d).length > 0, "No hay campos que actualizar");
