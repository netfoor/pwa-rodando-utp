/**
 * Responde 404 en formato uniforme cuando ninguna ruta de /api coincide.
 */
import { notFound } from "../utils/errors.js";

export const apiNotFound = (req, res, next) => next(notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
