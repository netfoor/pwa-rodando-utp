/**
 * Utilidades de fecha en la zona horaria de Puebla (America/Mexico_City).
 * El sistema numera los días 0 = lunes … 5 = sábado (6 = domingo, sin servicio).
 */

/** @param {Date} [fecha] @returns {number} índice 0 (lunes) … 6 (domingo) */
export function diaSemanaMx(fecha = new Date()) {
  const nombre = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Mexico_City" }).format(fecha);
  return { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[nombre];
}

/**
 * Día de referencia de un raite: el primer día de operación desde hoy
 * (o el primero de la semana si ya pasaron todos). Igual que la UI original.
 * @param {number[]} dias días en que opera el raite
 * @param {number} [hoy] índice del día actual
 */
export function diaReferencia(dias, hoy = diaSemanaMx()) {
  const ordenados = [...dias].sort((a, b) => a - b);
  return ordenados.find(d => d >= hoy) ?? ordenados[0];
}
