/**
 * Middleware de validación con zod. Valida y reemplaza req.body / req.query /
 * req.params por los datos ya parseados (con valores por defecto y coerciones).
 */

/**
 * @param {{body?: import("zod").ZodTypeAny, query?: import("zod").ZodTypeAny, params?: import("zod").ZodTypeAny}} schemas
 */
export const validate = schemas => (req, res, next) => {
  try {
    for (const parte of ["params", "query", "body"]) {
      if (!schemas[parte]) continue;
      const datos = schemas[parte].parse(req[parte] ?? {});
      // En Express 4 req.query es asignable; se guarda en validated para no depender de ello.
      req.validated = { ...req.validated, [parte]: datos };
    }
    next();
  } catch (err) {
    next(err);
  }
};
