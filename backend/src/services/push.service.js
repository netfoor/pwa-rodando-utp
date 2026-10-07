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
