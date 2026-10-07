/**
 * Lógica de autenticación: registro (con alta de perfil de conductor),
 * inicio de sesión con bcrypt y consulta del perfil propio.
 */
import bcrypt from "bcryptjs";
import { query, withTransaction } from "../db/pool.js";
import { firmarToken } from "../middlewares/auth.js";
import { AppError, conflict, notFound } from "../utils/errors.js";

const perfil = u => ({
  id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol,
  carrera: u.carrera, cuatrimestre: u.cuatrimestre,
  ...(u.auto && { auto: u.auto })
});

/** Crea la cuenta y devuelve {token, usuario}. Lanza 409 si el correo ya existe. */
export async function registrar(d) {
  const hash = await bcrypt.hash(d.password, 10);
  const user = await withTransaction(async db => {
    const dup = await db.query("SELECT 1 FROM users WHERE correo = $1", [d.correo]);
    if (dup.rowCount) throw conflict("CORREO_EXISTENTE", "Ese correo ya está registrado");
    const { rows } = await db.query(
      `INSERT INTO users (nombre, correo, password_hash, rol, carrera, cuatrimestre)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [d.nombre, d.correo, hash, d.rol, d.carrera ?? null, d.cuatrimestre ?? null]);
    if (d.rol === "conductor") {
      await db.query("INSERT INTO drivers (user_id, auto, placas) VALUES ($1,$2,$3)", [rows[0].id, d.auto, d.placas ?? null]);
    }
    return rows[0];
  });
  return { token: firmarToken(user), usuario: perfil(user) };
}

/** Valida credenciales. El mensaje es genérico para no revelar si el correo existe. */
export async function iniciarSesion({ correo, password }) {
  const { rows } = await query("SELECT * FROM users WHERE correo = $1", [correo]);
  const ok = rows.length && await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) throw new AppError(401, "CREDENCIALES_INVALIDAS", "Correo o contraseña incorrectos");
  return { token: firmarToken(rows[0]), usuario: perfil(rows[0]) };
}

export async function obtenerPerfil(id) {
  const { rows } = await query(
    "SELECT u.*, d.auto FROM users u LEFT JOIN drivers d ON d.user_id = u.id WHERE u.id = $1", [id]);
  if (!rows.length) throw notFound("Usuario no encontrado");
  return perfil(rows[0]);
}
