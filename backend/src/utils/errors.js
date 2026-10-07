/**
 * Error de aplicación con código HTTP y código de negocio.
 * El middleware errorHandler lo convierte en {error:{code,message,details}}.
 */
export class AppError extends Error {
  /**
   * @param {number} status código HTTP
   * @param {string} code código estable para el cliente (ej. RAITE_LLENO)
   * @param {string} message mensaje legible en español
   * @param {unknown} [details] información adicional (ej. errores de validación)
   */
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, "SOLICITUD_INVALIDA", message, details);
export const unauthorized = (message = "Necesitas iniciar sesión") => new AppError(401, "NO_AUTORIZADO", message);
export const forbidden = (message = "No tienes permiso para hacer esto") => new AppError(403, "PROHIBIDO", message);
export const notFound = (message = "No encontrado") => new AppError(404, "NO_ENCONTRADO", message);
export const conflict = (code, message) => new AppError(409, code, message);
