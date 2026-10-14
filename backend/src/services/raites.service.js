/**
 * Lógica de raites: listado con filtros (zona, turno, tipo, libres, día),
 * cálculo de lugares libres (asientos − reservas confirmadas del día) y CRUD
 * restringido al conductor dueño.
 */
import { query } from "../db/pool.js";
import { diaReferencia } from "../utils/fecha.js";
import { forbidden, notFound, badRequest } from "../utils/errors.js";

const SELECT = `
  SELECT r.id, r.zona_id, r.tipo, r.hora, r.dias, r.asientos, r.aportacion, r.paradas, r.activo, r.driver_id,
         d.auto, d.rating, d.viajes, d.verificado,
         u.nombre AS c_nombre, u.carrera AS c_carrera, u.cuatrimestre AS c_cuatri
    FROM raites r
    JOIN drivers d ON d.user_id = r.driver_id
    JOIN users u ON u.id = r.driver_id`;

/** Turno por hora de salida (mismos cortes que la línea de tiempo de la UI). */
export function turnoDe(hora) {
  const h = parseInt(hora, 10);
  return h < 12 ? "manana" : h < 18 ? "tarde" : "noche";
}

const coincideTurno = (hora, turno) => {
  if (turno === "matutino") return turnoDe(hora) === "manana";
  if (turno === "vespertino") return turnoDe(hora) !== "manana";
  return turnoDe(hora) === turno;
};

/** Cuenta de reservas confirmadas por raite y día: { [raiteId]: { [dia]: n } }. */
async function ocupacion(ids) {
  if (!ids.length) return {};
  const { rows } = await query(
    `SELECT raite_id, dia, count(*)::int AS n FROM reservas
      WHERE estado = 'confirmada' AND raite_id = ANY($1) GROUP BY raite_id, dia`, [ids]);
  const out = {};
  for (const r of rows) (out[r.raite_id] ??= {})[r.dia] = r.n;
  return out;
}

function toDto(r, ocup, diaPedido) {
  const dia = diaPedido ?? diaReferencia(r.dias);
  const libresPorDia = Object.fromEntries(r.dias.map(d => [d, Math.max(r.asientos - (ocup?.[d] ?? 0), 0)]));
  return {
    id: r.id, zona: r.zona_id, tipo: r.tipo, hora: r.hora, dias: r.dias,
    asientos: r.asientos, aportacion: r.aportacion, paradas: r.paradas, activo: r.activo,
    auto: r.auto,
    conductor: {
      id: r.driver_id, nombre: r.c_nombre, carrera: r.c_carrera, cuatri: r.c_cuatri,
      rating: Number(r.rating), viajes: r.viajes, verificado: r.verificado
    },
    dia,
    libres: libresPorDia[dia] ?? r.asientos,
    libresPorDia
  };
}

/** Lista raites activos aplicando los filtros de la interfaz. */
export async function listar({ zona, turno, tipo, libres, dia } = {}) {
  const { rows } = await query(`${SELECT} WHERE r.activo ORDER BY r.hora, r.id`);
  const ocup = await ocupacion(rows.map(r => r.id));
  return rows
    .filter(r => (!zona || zona === "todas" || r.zona_id === zona)
      && (!tipo || r.tipo === tipo)
      && (!turno || coincideTurno(r.hora, turno))
      && (dia === undefined || r.dias.includes(dia)))
    .map(r => toDto(r, ocup[r.id], dia))
    .filter(r => !libres || r.libres > 0);
}

/** Raites del conductor autenticado (incluye los desactivados), para su panel. */
export async function listarMios(user) {
  const { rows } = await query(`${SELECT} WHERE r.driver_id = $1 ORDER BY r.hora, r.id`, [user.id]);
  const ocup = await ocupacion(rows.map(r => r.id));
  return rows.map(r => toDto(r, ocup[r.id]));
}

/** Todos los raites (activos o no); solo para el panel de administración. */
export async function listarTodos() {
  const { rows } = await query(`${SELECT} ORDER BY r.id`);
  const ocup = await ocupacion(rows.map(r => r.id));
  return rows.map(r => toDto(r, ocup[r.id]));
}

export async function obtener(id, dia) {
  const { rows } = await query(`${SELECT} WHERE r.id = $1`, [id]);
  if (!rows.length) throw notFound("Raite no encontrado");
  return toDto(rows[0], (await ocupacion([id]))[id], dia);
}

async function asegurarDueno(id, user) {
  const { rows } = await query("SELECT driver_id FROM raites WHERE id = $1", [id]);
  if (!rows.length) throw notFound("Raite no encontrado");
  if (rows[0].driver_id !== user.id && user.rol !== "admin") throw forbidden("Solo el dueño del raite puede modificarlo");
}

async function validarZona(zona) {
  if (!(await query("SELECT 1 FROM zonas WHERE id = $1", [zona])).rowCount) throw badRequest("La zona no existe");
}

/** Publica un raite a nombre del conductor autenticado. */
export async function crear(user, d) {
  const drv = await query("SELECT 1 FROM drivers WHERE user_id = $1", [user.id]);
  if (!drv.rowCount) throw forbidden("Primero completa tu perfil de conductor");
  await validarZona(d.zona);
  const { rows } = await query(
    `INSERT INTO raites (zona_id, driver_id, tipo, hora, dias, asientos, aportacion, paradas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [d.zona, user.id, d.tipo, d.hora, d.dias, d.asientos, d.aportacion, d.paradas]);
  return obtener(rows[0].id);
}

const COLUMNAS = { zona: "zona_id", tipo: "tipo", hora: "hora", dias: "dias", asientos: "asientos", aportacion: "aportacion", paradas: "paradas", activo: "activo" };

export async function actualizar(id, user, cambios) {
  await asegurarDueno(id, user);
  if (cambios.zona) await validarZona(cambios.zona);
  const campos = Object.keys(cambios);
  const sets = campos.map((c, i) => `${COLUMNAS[c]} = $${i + 2}`).join(", ");
  await query(`UPDATE raites SET ${sets} WHERE id = $1`, [id, ...campos.map(c => cambios[c])]);
  return obtener(id);
}

export async function eliminar(id, user) {
  await asegurarDueno(id, user);
  await query("DELETE FROM raites WHERE id = $1", [id]);
}
