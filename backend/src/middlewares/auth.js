/**
 * Autenticación con JWT (cabecera Authorization: Bearer <token>) y control
 * de acceso por rol. Expone requireAuth, optionalAuth y requireRole.
 */
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { unauthorized, forbidden } from "../utils/errors.js";
import { query } from "../db/pool.js";

/** Firma un token con los datos mínimos del usuario. */
export const firmarToken = user =>
  jwt.sign({ sub: user.id, rol: user.rol }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

function leerToken(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  try {
    const p = jwt.verify(h.slice(7), env.jwtSecret);
    return { id: Number(p.sub) };
  } catch {
    return undefined; // token presente pero inválido/expirado
  }
}

/** Carga el rol actual desde la BD; el token solo identifica al usuario. */
async function usuarioActual(id) {
  const { rows } = await query("SELECT id, rol FROM users WHERE id = $1", [id]);
  return rows[0] || null;
}

/** Exige sesión válida. Deja el usuario (con su rol actual) en req.user. */
export async function requireAuth(req, res, next) {
  const token = leerToken(req);
  if (!token) return next(unauthorized(token === undefined ? "Tu sesión expiró, inicia sesión de nuevo" : undefined));
  try {
    const u = await usuarioActual(token.id);
    if (!u) return next(unauthorized("Tu sesión ya no es válida, inicia sesión de nuevo"));
    req.user = u;
    next();
  } catch (err) {
    next(err);
  }
}

/** Adjunta req.user si hay token válido; si no, continúa como anónimo. */
export async function optionalAuth(req, res, next) {
  const token = leerToken(req);
  if (!token) return next();
  try {
    req.user = (await usuarioActual(token.id)) || undefined;
    next();
  } catch (err) {
    next(err);
  }
}

/** Exige que el usuario autenticado tenga alguno de los roles dados. */
export const requireRole = (...roles) => [
  requireAuth,
  (req, res, next) => (roles.includes(req.user.rol) ? next() : next(forbidden()))
];
