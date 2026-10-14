/**
 * Caché en memoria para respuestas GET públicas de la API.
 * - cache(ttl): sirve la respuesta guardada (X-Cache: HIT) o la guarda (X-Cache: MISS).
 * - invalidarAlEscribir: cualquier POST/PATCH/DELETE exitoso vacía la caché, así
 *   nunca se muestra información vieja después de un cambio.
 * - Cache-Control: no-cache + ETag permite al navegador revalidar (304 sin cuerpo).
 */

const store = new Map();                 // clave (URL) → { status, cuerpo, expira, guardada }
const contadores = { hits: 0, misses: 0, invalidaciones: 0 };

/** @param {number} ttlSegundos tiempo de vida de cada entrada */
export const cache = ttlSegundos => (req, res, next) => {
  if (req.method !== "GET") return next();
  const clave = req.originalUrl;
  const e = store.get(clave);
  res.setHeader("Cache-Control", "no-cache");   // el navegador revalida con ETag

  if (e && e.expira > Date.now()) {
    contadores.hits++;
    res.setHeader("X-Cache", "HIT");
    res.setHeader("Age", Math.floor((Date.now() - e.guardada) / 1000));
    return res.status(e.status).type("application/json").send(e.cuerpo);
  }

  contadores.misses++;
  res.setHeader("X-Cache", "MISS");
  const json = res.json.bind(res);
  res.json = cuerpo => {
    if (res.statusCode === 200) {
      store.set(clave, { status: 200, cuerpo: JSON.stringify(cuerpo), expira: Date.now() + ttlSegundos * 1000, guardada: Date.now() });
    }
    return json(cuerpo);
  };
  next();
};

// Rutas de escritura que no cambian datos cacheables (no vale la pena vaciar por ellas)
const NO_INVALIDAN = /^\/(auth|calculadora|push)\b/;

/** Vacía la caché cuando una escritura termina bien. Montar en /api. */
export function invalidarAlEscribir(req, res, next) {
  if (req.method !== "GET" && !NO_INVALIDAN.test(req.path)) {
    res.on("finish", () => { if (res.statusCode < 400) limpiar(); });
  }
  next();
}

export function limpiar() {
  if (store.size) contadores.invalidaciones++;
  store.clear();
}

export function estadisticas() {
  const total = contadores.hits + contadores.misses;
  return {
    entradas: store.size,
    ...contadores,
    aciertos: total ? Math.round((contadores.hits / total) * 100) + "%" : "0%"
  };
}
