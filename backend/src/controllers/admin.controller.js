/**
 * Controlador del panel de administración: catálogos CRUD, usuarios y vistas globales.
 */
import * as admin from "../services/admin.service.js";

const ident = (nombre, valor) => (nombre === "zonas" ? valor : Number(valor));

export const resumen = async (req, res) => res.json(await admin.resumen());
export const listarRecurso = async (req, res) => res.json({ items: await admin.listar(req.params.recurso) });
export const crearRecurso = async (req, res) => res.status(201).json(await admin.crear(req.params.recurso, req.body));
export const actualizarRecurso = async (req, res) =>
  res.json(await admin.actualizar(req.params.recurso, ident(req.params.recurso, req.params.id), req.body));
export const eliminarRecurso = async (req, res) => {
  await admin.eliminar(req.params.recurso, ident(req.params.recurso, req.params.id));
  res.status(204).end();
};

export const usuarios = async (req, res) => res.json({ items: await admin.listarUsuarios() });
export const cambiarRol = async (req, res) =>
  res.json(await admin.cambiarRol(req.validated.params.id, req.validated.body.rol, req.user));
export const eliminarUsuario = async (req, res) => {
  await admin.eliminarUsuario(req.validated.params.id, req.user);
  res.status(204).end();
};
export const reservas = async (req, res) => res.json({ items: await admin.listarReservas() });
export const raites = async (req, res) => res.json({ items: await admin.listarRaitesAdmin() });
