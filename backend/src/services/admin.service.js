/**
 * Servicios del panel de administración: CRUD genérico de catálogos (zonas,
 * testimonios, FAQ), gestión de usuarios y vistas globales de raites y reservas.
 */
import { query, withTransaction } from "../db/pool.js";
import { conflict, notFound, badRequest } from "../utils/errors.js";
import { zonaAdmin, testimonioAdmin, faqAdmin } from "../schemas/admin.schema.js";
import * as raites from "./raites.service.js";

/** Catálogos editables: tabla, llave primaria, columnas y esquema zod de entrada. */
export const RECURSOS = {
  zonas:       { tabla: "zonas",       pk: "id", cols: ["id", "nombre", "km", "x", "y", "color", "trazo_svg"], schema: zonaAdmin, orden: "orden, nombre" },
  testimonios: { tabla: "testimonios", pk: "id", cols: ["texto", "nombre", "rol"], schema: testimonioAdmin, orden: "orden, id" },
  faq:         { tabla: "faq",         pk: "id", cols: ["pregunta", "respuesta"], schema: faqAdmin, orden: "orden, id" }
};

const recurso = nombre => RECURSOS[nombre] ?? (() => { throw notFound("Recurso no encontrado"); })();

export async function listar(nombre) {
  const r = recurso(nombre);
  return (await query(`SELECT * FROM ${r.tabla} ORDER BY ${r.orden}`)).rows;
}

export async function crear(nombre, datos) {
  const r = recurso(nombre);
  const d = r.schema.parse(datos);
  const cols = r.cols.filter(c => d[c] !== undefined);
  const { rows } = await query(
    `INSERT INTO ${r.tabla} (${cols.join(",")}, orden)
     VALUES (${cols.map((_, i) => "$" + (i + 1)).join(",")}, (SELECT COALESCE(MAX(orden), 0) + 1 FROM ${r.tabla}))
     RETURNING *`, cols.map(c => d[c]));
  return rows[0];
}

export async function actualizar(nombre, id, datos) {
  const r = recurso(nombre);
  const d = r.schema.partial().omit(r.pk === "id" && nombre === "zonas" ? { id: true } : {}).parse(datos);
  const cols = Object.keys(d).filter(c => r.cols.includes(c));
  if (!cols.length) throw badRequest("No hay campos que actualizar");
  const { rows } = await query(
    `UPDATE ${r.tabla} SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")} WHERE ${r.pk} = $1 RETURNING *`,
    [id, ...cols.map(c => d[c])]);
  if (!rows.length) throw notFound("Registro no encontrado");
  return rows[0];
}

export async function eliminar(nombre, id) {
  const r = recurso(nombre);
  try {
    const res = await query(`DELETE FROM ${r.tabla} WHERE ${r.pk} = $1`, [id]);
    if (!res.rowCount) throw notFound("Registro no encontrado");
  } catch (err) {
    if (err.code === "23503") throw conflict("EN_USO", "No se puede eliminar: hay raites o solicitudes que usan este registro");
    throw err;
  }
}

/* ---------- Usuarios ---------- */
export async function listarUsuarios() {
  return (await query(
    `SELECT u.id, u.nombre, u.correo, u.rol, u.carrera, u.cuatrimestre, u.es_demo, u.created_at AS creado, d.auto
       FROM users u LEFT JOIN drivers d ON d.user_id = u.id ORDER BY u.id`)).rows;
}

/** Cambia el rol; al volverse conductor se le crea un perfil mínimo si no lo tenía. */
export async function cambiarRol(id, rol, quien) {
  if (id === quien.id) throw badRequest("No puedes cambiar tu propio rol");
  return withTransaction(async db => {
    const { rows } = await db.query("UPDATE users SET rol = $2 WHERE id = $1 RETURNING id, nombre, correo, rol", [id, rol]);
    if (!rows.length) throw notFound("Usuario no encontrado");
    if (rol === "conductor") await db.query("INSERT INTO drivers (user_id, auto) VALUES ($1,'Por definir') ON CONFLICT DO NOTHING", [id]);
    return rows[0];
  });
}

export async function eliminarUsuario(id, quien) {
  if (id === quien.id) throw badRequest("No puedes eliminar tu propia cuenta");
  const res = await query("DELETE FROM users WHERE id = $1", [id]);
  if (!res.rowCount) throw notFound("Usuario no encontrado");
}

/* ---------- Vistas globales ---------- */
export async function listarReservas() {
  return (await query(
    `SELECT v.codigo, v.dia, v.parada, v.nombre, v.estado, v.created_at AS creada,
            r.hora, r.tipo, r.zona_id AS zona, u.correo AS usuario
       FROM reservas v JOIN raites r ON r.id = v.raite_id LEFT JOIN users u ON u.id = v.user_id
      ORDER BY v.created_at DESC, v.id DESC LIMIT 200`)).rows;
}

export const listarRaitesAdmin = () => raites.listarTodos();

/** Conteos por tabla para las tarjetas del panel. */
export async function resumen() {
  const { rows } = await query(`SELECT
    (SELECT count(*) FROM raites)::int AS raites, (SELECT count(*) FROM zonas)::int AS zonas,
    (SELECT count(*) FROM testimonios)::int AS testimonios, (SELECT count(*) FROM faq)::int AS faq,
    (SELECT count(*) FROM users)::int AS usuarios,
    (SELECT count(*) FROM reservas WHERE estado = 'confirmada')::int AS reservas,
    (SELECT count(*) FROM solicitudes_conductor WHERE estado = 'pendiente')::int AS solicitudes`);
  return rows[0];
}
