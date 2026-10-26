/**
 * Esquemas del seguimiento en vivo.
 */
import { z } from "zod";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");

export const vivoQuery = z.object({ fecha: fecha.optional() });
export const fechaBody = z.object({ fecha: fecha.optional() });

export const posicionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precision: z.number().min(0).max(5000).optional(),
  velocidad: z.number().min(0).max(80).optional(),
  rumbo: z.number().min(0).max(360).optional(),
  fecha: fecha.optional()
});

export const estadoViajeSchema = z.object({
  estado: z.enum(["en_camino", "recogiendo", "en_ruta", "finalizado"]),
  fecha: fecha.optional()
});

export const solicitarVivoSchema = z.object({
  parada: z.string().trim().min(2).max(60),
  nombre: z.string().trim().min(2).max(80).optional(),
  fecha: fecha.optional()
});

export const solicitudParams = z.object({
  id: z.coerce.number().int().positive(),
  codigo: z.string().trim().toUpperCase().regex(/^RU-[A-Z0-9]{4}$/, "Código inválido")
});
