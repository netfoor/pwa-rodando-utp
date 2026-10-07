/**
 * Controlador de notificaciones push: llave pública, suscripción y envío (admin).
 */
import * as push from "../services/push.service.js";

export const llavePublica = (req, res) => res.json({ publicKey: push.clavePublica() });
export const suscribir = async (req, res) => {
  await push.suscribir(req.user?.id, req.validated.body);
  res.status(201).json({ ok: true });
};
export const enviar = async (req, res) => {
  const { userId, ...payload } = req.validated.body;
  res.json({ enviados: await push.enviar(payload, userId) });
};
