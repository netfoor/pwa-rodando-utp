import * as ritmo from "../services/ritmo.service.js";

export const patron = async (req, res) => res.json(await ritmo.patron(req.user));
export const demanda = async (req, res) => res.json({ demanda: await ritmo.demanda() });
export const crearGrupo = async (req, res) => res.status(201).json(await ritmo.crearGrupo(req.user, req.validated.body));
export const misGrupos = async (req, res) => res.json({ grupos: await ritmo.misGrupos(req.user) });
export const ausencia = async (req, res) =>
  res.status(201).json(await ritmo.ausencia(req.user, req.validated.params.id, req.validated.body));
export const salir = async (req, res) => res.json(await ritmo.salir(req.user, req.validated.params.id));
