/**
 * Notificaciones push con web-push (llaves VAPID por variables de entorno).
 * Si no hay llaves configuradas, el servicio se desactiva sin romper la app.
 */
import webpush from "web-push";
import { env } from "../config/env.js";
import { query } from "../db/pool.js";
import { AppError } from "../utils/errors.js";

export const pushActivo = Boolean(env.vapid.publicKey && env.vapid.privateKey);
if (pushActivo) webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);

export function clavePublica() {
  if (!pushActivo) throw new AppError(503, "PUSH_NO_CONFIGURADO", "Las notificaciones push no están configuradas");
  return env.vapid.publicKey;
}

/** Guarda (o actualiza) la suscripción del navegador, opcionalmente ligada a un usuario. */
export async function suscribir(userId, { endpoint, keys }) {
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = COALESCE($1, push_subscriptions.user_id), p256dh = $3, auth = $4`,
    [userId ?? null, endpoint, keys.p256dh, keys.auth]);
}

/** Envía una notificación de prueba a las suscripciones del propio usuario. */
export async function enviarPrueba(userId) {
  if (!pushActivo) throw new AppError(503, "PUSH_NO_CONFIGURADO", "Las notificaciones push no están configuradas");
  const { rows } = await query("SELECT count(*)::int AS total FROM push_subscriptions WHERE user_id = $1", [userId]);
  const enviados = await enviar({
    titulo: "Rodando UTP",
    mensaje: "¡Funciona! Así se verán los avisos de tus raites.",
    url: "/notificaciones.html"
  }, userId);
  return { enviados, total: rows[0].total };
}


/**
 * Registra y envía un aviso de un viaje. El índice parcial de la bitácora evita
 * repetir avisos de estado/proximidad, pero permite una entrada por solicitud o
 * aviso de pasajero, y deja constancia del envío.
 */
export async function notificarViaje({ userId, raiteId, fecha, tipo, parada = null, titulo, mensaje, url = "/" }) {
  if (!userId || !fecha) return { resultado: "omitido" };
  const ins = await query(
    `INSERT INTO notificaciones_log (user_id, raite_id, fecha, tipo, parada)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT DO NOTHING
     RETURNING id`, [userId, raiteId, fecha, tipo, parada]);
  if (!ins.rowCount) return { resultado: "duplicado" };

  let resultado = "omitido";
  let detalle = "Las notificaciones push no están configuradas";
  if (pushActivo) {
    try {
      const enviados = await enviar({ titulo, mensaje, url }, userId);
      resultado = enviados ? "enviado" : "sin_suscripcion";
      detalle = enviados ? null : "El usuario no tiene una suscripción activa";
    } catch {
      detalle = "No se pudo enviar la notificación";
    }
  }
  await query(
    "UPDATE notificaciones_log SET resultado=$2, detalle=$3 WHERE id=$1",
    [ins.rows[0].id, resultado, detalle]);
  return { resultado };
}

/**
 * Envía una notificación a las suscripciones de un usuario (o a todas si no se indica).
 * Elimina las suscripciones caducadas (404/410). @returns {Promise<number>} envíos exitosos
 */
export async function enviar({ titulo, mensaje, url = "/#rutas" }, userId) {
  if (!pushActivo) return 0;
  const { rows } = userId
    ? await query("SELECT * FROM push_subscriptions WHERE user_id = $1", [userId])
    : await query("SELECT * FROM push_subscriptions");
  const payload = JSON.stringify({ titulo, mensaje, url });
  let enviados = 0;
  await Promise.all(rows.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      enviados++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await query("DELETE FROM push_subscriptions WHERE id = $1", [s.id]);
    }
  }));
  return enviados;
}
