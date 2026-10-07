/**
 * Lógica de reservaciones. La creación corre en una transacción que bloquea
 * la fila del raite (SELECT … FOR UPDATE) para que dos solicitudes simultáneas
 * no puedan vender el mismo último asiento (sin sobreventa).
 */
import { query, withTransaction } from "../db/pool.js";
import { generarCodigo } from "../utils/codigo.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors.js";
import * as push from "./push.service.js";

export const PARADA_UTP = "UTP · Puerta principal";

/**
 * Aparta un lugar. Errores de negocio: RAITE_LLENO, RESERVA_DUPLICADA, 404, 400.
 * @returns {Promise<{codigo:string, raiteId:number, dia:number, parada:string, nombre:string, estado:string}>}
 */
export async function crear(user, { raiteId, dia, parada, nombre }) {
  const reserva = await withTransaction(async db => {
    // El bloqueo de fila serializa las reservas concurrentes del mismo raite.
    const { rows } = await db.query(
      "SELECT id, driver_id, dias, asientos, paradas, activo, hora FROM raites WHERE id = $1 FOR UPDATE", [raiteId]);
    const raite = rows[0];
    if (!raite || !raite.activo) throw notFound("Raite no encontrado");
    if (raite.driver_id === user.id) throw badRequest("No puedes apartar lugar en tu propio raite");
    if (!raite.dias.includes(dia)) throw badRequest("El raite no sale ese día");
    if (![...raite.paradas, PARADA_UTP].includes(parada)) throw badRequest("Esa parada no pertenece al raite");

    const { rows: [{ n }] } = await db.query(
      "SELECT count(*)::int AS n FROM reservas WHERE raite_id = $1 AND dia = $2 AND estado = 'confirmada'", [raiteId, dia]);
    if (n >= raite.asientos) throw conflict("RAITE_LLENO", "El raite ya no tiene lugares libres ese día");

    const dup = await db.query(
      "SELECT 1 FROM reservas WHERE raite_id = $1 AND user_id = $2 AND dia = $3 AND estado = 'confirmada'", [raiteId, user.id, dia]);
    if (dup.rowCount) throw conflict("RESERVA_DUPLICADA", "Ya tienes un lugar apartado en este raite ese día");

    // Código único: se reintenta en el improbable caso de colisión.
    for (let intento = 0; intento < 5; intento++) {
      const codigo = generarCodigo();
      const ins = await db.query(
        `INSERT INTO reservas (codigo, raite_id, user_id, dia, parada, nombre) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (codigo) DO NOTHING RETURNING codigo, raite_id AS "raiteId", dia, parada, nombre, estado`,
        [codigo, raiteId, user.id, dia, parada, nombre]);
      if (ins.rowCount) return { ...ins.rows[0], _conductor: raite.driver_id, _hora: raite.hora };
    }
    throw conflict("CODIGO_NO_DISPONIBLE", "No se pudo generar el código, intenta de nuevo");
  });

  // Aviso al conductor: fuera de la transacción y sin afectar la respuesta si falla.
  const { _conductor, _hora, ...publica } = reserva;
  push.enviar({ titulo: "Nuevo lugar apartado 🚗", mensaje: `${nombre} apartó lugar en tu raite de las ${_hora}.` }, _conductor).catch(() => {});
  return publica;
}

/** Reservaciones confirmadas del usuario, con los datos del raite para mostrarlas. */
export async function mias(user) {
  const { rows } = await query(
    `SELECT v.codigo, v.raite_id AS "raiteId", v.dia, v.parada, v.nombre, v.estado, v.created_at AS "creada",
            r.hora, r.tipo, r.zona_id AS zona, r.aportacion, u.nombre AS conductor
       FROM reservas v JOIN raites r ON r.id = v.raite_id JOIN users u ON u.id = r.driver_id
      WHERE v.user_id = $1 AND v.estado = 'confirmada' ORDER BY v.dia, r.hora`, [user.id]);
  return rows;
}

/** Cancela una reservación propia (el admin puede cancelar cualquiera). */
export async function cancelar(codigo, user) {
  const { rows } = await query("SELECT id, user_id, estado FROM reservas WHERE codigo = $1", [codigo]);
  if (!rows.length) throw notFound("Reservación no encontrada");
  if (rows[0].user_id !== user.id && user.rol !== "admin") throw forbidden("Esa reservación no es tuya");
  await query("UPDATE reservas SET estado = 'cancelada' WHERE id = $1", [rows[0].id]);
  return { codigo, estado: "cancelada" };
}
