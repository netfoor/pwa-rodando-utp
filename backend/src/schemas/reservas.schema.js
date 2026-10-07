/**
 * Esquemas de entrada de reservaciones.
 */
import { z } from "zod";
import { dia } from "./common.js";

export const crearReservaSchema = z.object({
  raiteId: z.coerce.number().int().positive(),
  dia,
  parada: z.string().trim().min(2).max(60),
  nombre: z.string().trim().min(2, "Escribe tu nombre").max(80)
});

export const codigoParam = z.object({ codigo: z.string().trim().toUpperCase().regex(/^RU-[A-Z0-9]{4}$/, "Código inválido") });
