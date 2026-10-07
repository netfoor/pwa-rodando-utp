/**
 * Autenticación con JWT (cabecera Authorization: Bearer <token>) y control
 * de acceso por rol. Expone requireAuth, optionalAuth y requireRole.
 */
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { unauthorized, forbidden } from "../utils/errors.js";

/** Firma un token con los datos mínimos del usuario. */
export const firmarToken = user =>
  jwt.sign({ sub: user.id, rol: user.rol }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

function leerToken(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  try {
    const p = jwt.verify(h.slice(7), env.jwtSecret);
    return { id: Number(p.sub), rol: p.rol };
  } catch {
    return undefined; // token presente pero inválido/expirado
  }
}

/** Exige sesión válida. Deja el usuario en req.user. */
export function requireAuth(req, res, next) {
  const u = leerToken(req);
  if (!u) return next(unauthorized(u === undefined ? "Tu sesión expiró, inicia sesión de nuevo" : undefined));
  req.user = u;
  next();
}

/** Adjunta req.user si hay token válido; si no, continúa como anónimo. */
export function optionalAuth(req, res, next) {
  const u = leerToken(req);
  if (u) req.user = u;
  next();
}

/** Exige que el usuario autenticado tenga alguno de los roles dados. */
export const requireRole = (...roles) => [
  requireAuth,
  (req, res, next) => (roles.includes(req.user.rol) ? next() : next(forbidden()))
];
