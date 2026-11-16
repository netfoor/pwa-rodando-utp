import { z } from "zod";

const dia = z.coerce.number().int().min(0).max(5);

export const crearGrupoSchema = z.object({
  raiteId: z.coerce.number().int().positive(),
  dias: z.array(dia).min(1).max(6).refine(d => new Set(d).size === d.length, "Días repetidos"),
  parada: z.string().trim().min(1).max(80)
});

export const ausenciaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha AAAA-MM-DD"),
  motivo: z.string().trim().max(120).optional()
});
