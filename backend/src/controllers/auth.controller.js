/**
 * Controlador de autenticación: traduce HTTP ↔ auth.service.
 */
import * as auth from "../services/auth.service.js";

export const registro = async (req, res) => res.status(201).json(await auth.registrar(req.validated.body));
export const login = async (req, res) => res.json(await auth.iniciarSesion(req.validated.body));
export const me = async (req, res) => res.json({ usuario: await auth.obtenerPerfil(req.user.id) });
