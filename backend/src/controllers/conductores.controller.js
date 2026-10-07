/**
 * Controlador de solicitudes de conductor (público) y su administración.
 */
import * as svc from "../services/conductores.service.js";

export const solicitud = async (req, res) => res.status(201).json(await svc.crearSolicitud(req.validated.body));
export const listar = async (req, res) => res.json({ solicitudes: await svc.listarSolicitudes(req.query.estado) });
export const aprobar = async (req, res) => res.json(await svc.aprobar(req.validated.params.id));
