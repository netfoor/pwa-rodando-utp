/**
 * Envuelve un handler async de Express para que los errores rechazados
 * lleguen al middleware de errores (Express 4 no lo hace por sí solo).
 */
export const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
