/**
 * Controlador del seguimiento en vivo: estado del viaje, posición del conductor,
 * solicitudes de lugar y avisos. Difunde los cambios por WebSocket.
 */
import * as vivo from "../services/vivo.service.js";
import { difundir, difundirPosicion } from "../realtime.js";

export const estado = async (req, res) =>
  res.json(await vivo.estado(req.user, req.validated.params.id, req.validated.query));

export const iniciar = async (req, res) => {
  const r = await vivo.iniciar(req.user, req.validated.params.id, req.validated.body);
  difundir(req.validated.params.id, r.fecha, { tipo: "estado", estado: r.viaje.estado });
  res.status(201).json(r);
};

export const posicion = async (req, res) => {
  const r = await vivo.actualizarPosicion(req.user, req.validated.params.id, req.validated.body);
  await difundirPosicion(req.validated.params.id, r.fecha);
  res.json(r);
};

async function aplicarEstado(req, res, estado) {
  const r = await vivo.cambiarEstado(req.user, req.validated.params.id, { ...req.validated.body, estado });
  difundir(req.validated.params.id, r.fecha, { tipo: "estado", estado: r.viaje.estado });
  if (r.viaje.estado === "finalizado") {
    difundir(req.validated.params.id, r.fecha, { tipo: "finalizado", estado: "finalizado" });
  } else {
    await difundirPosicion(req.validated.params.id, r.fecha);
  }
  res.json(r);
}

export const cambiarEstado = (req, res) => aplicarEstado(req, res, req.validated.body.estado);
export const finalizar = (req, res) => aplicarEstado(req, res, "finalizado");

export const solicitar = async (req, res) => {
  const r = await vivo.solicitar(req.user, req.validated.params.id, req.validated.body);
  difundir(req.validated.params.id, r.fecha, { tipo: "solicitudes" });
  res.status(201).json(r);
};

export const solicitudes = async (req, res) =>
  res.json({ solicitudes: await vivo.solicitudes(req.user, req.validated.params.id, req.validated.query) });

export const responder = async (req, res) => {
  const { id, codigo } = req.validated.params;
  const r = await vivo.responderSolicitud(req.user, id, codigo, "aceptar", req.validated.body?.fecha);
  difundir(id, r.fecha, { tipo: "reserva", estado: r.estado });
  difundir(id, r.fecha, { tipo: "solicitudes" });
  await difundirPosicion(id, r.fecha);
  res.json(r);
};

export const rechazar = async (req, res) => {
  const { id, codigo } = req.validated.params;
  const r = await vivo.responderSolicitud(req.user, id, codigo, "rechazar", req.validated.body?.fecha);
  difundir(id, r.fecha, { tipo: "reserva", estado: r.estado });
  difundir(id, r.fecha, { tipo: "solicitudes" });
  await difundirPosicion(id, r.fecha);
  res.json(r);
};

export const avisar = async (req, res) =>
  res.json(await vivo.avisar(req.user, req.validated.params.id));
