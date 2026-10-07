/**
 * Controlador de raites: listado filtrado, detalle y CRUD del conductor dueño.
 */
import * as raites from "../services/raites.service.js";

export const listar = async (req, res) => {
  const lista = await raites.listar(req.validated.query);
  res.json({ total: lista.length, raites: lista });
};
export const detalle = async (req, res) => res.json(await raites.obtener(req.validated.params.id));
export const crear = async (req, res) => res.status(201).json(await raites.crear(req.user, req.validated.body));
export const actualizar = async (req, res) =>
  res.json(await raites.actualizar(req.validated.params.id, req.user, req.validated.body));
export const eliminar = async (req, res) => {
  await raites.eliminar(req.validated.params.id, req.user);
  res.status(204).end();
};
