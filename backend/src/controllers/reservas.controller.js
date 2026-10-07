/**
 * Controlador de reservaciones: apartar, listar las propias y cancelar.
 */
import * as reservas from "../services/reservas.service.js";

export const crear = async (req, res) => res.status(201).json(await reservas.crear(req.user, req.validated.body));
export const mias = async (req, res) => res.json({ reservas: await reservas.mias(req.user) });
export const cancelar = async (req, res) => res.json(await reservas.cancelar(req.validated.params.codigo, req.user));
