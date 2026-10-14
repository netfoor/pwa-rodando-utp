/**
 * Esquemas del panel de administración: recursos CRUD genéricos (zonas,
 * testimonios, FAQ) y cambio de rol de usuarios.
 */
import { z } from "zod";

export const zonaAdmin = z.object({
  id: z.string().regex(/^[a-z0-9_-]{2,20}$/, "Id: minúsculas, números, - o _ (2-20)"),
  nombre: z.string().trim().min(2).max(60),
  km: z.coerce.number().int().min(1).max(60),
  x: z.coerce.number().int().min(0).max(600),
  y: z.coerce.number().int().min(0).max(420),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color hexadecimal, ej. #FF8A3D"),
  trazo_svg: z.string().trim().regex(/^M[\d\sCSLcsl.,-]+$/, "Trazo SVG inválido (ej. M255 235 C 300 225, 360 175 440 140)").max(400)
});

export const testimonioAdmin = z.object({
  texto: z.string().trim().min(10).max(400),
  nombre: z.string().trim().min(2).max(60),
  rol: z.string().trim().min(2).max(80)
});

export const faqAdmin = z.object({
  pregunta: z.string().trim().min(5).max(200),
  respuesta: z.string().trim().min(5).max(1000)
});

export const rolUsuarioSchema = z.object({ rol: z.enum(["pasajero", "conductor", "admin"]) });
