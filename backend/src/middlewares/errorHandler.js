/**
 * Manejo uniforme de errores: toda respuesta de error tiene la forma
 * {error:{code,message,details}}. Traduce errores de zod, JSON mal formado,
 * violaciones de unicidad de PostgreSQL y fallos inesperados (500).
 */
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { env } from "../config/env.js";

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = 500, code = "ERROR_INTERNO", message = "Ocurrió un error inesperado", details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400; code = "VALIDACION"; message = "Revisa los datos enviados";
    details = err.issues.map(i => ({ campo: i.path.join("."), mensaje: i.message }));
  } else if (err.type === "entity.parse.failed") {
    status = 400; code = "JSON_INVALIDO"; message = "El cuerpo de la petición no es JSON válido";
  } else if (err.code === "23505") { // unique_violation
    status = 409; code = "DUPLICADO"; message = "Ese registro ya existe";
  } else if (err.code === "23503") { // foreign_key_violation
    status = 400; code = "REFERENCIA_INVALIDA"; message = "Referencia a un registro inexistente";
  }

  if (status === 500 && !env.isTest) console.error(err);
  res.status(status).json({ error: { code, message, ...(details !== undefined && { details }) } });
}
