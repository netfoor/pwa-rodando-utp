/**
 * Lecturas de catálogo: zonas, testimonios, FAQ, configuración y estadísticas
 * del hero. Son datos casi estáticos que alimentan la interfaz.
 */
import { query } from "../db/pool.js";
import { notFound } from "../utils/errors.js";

const zonaDto = r => ({ id: r.id, nombre: r.nombre, km: r.km, x: r.x, y: r.y, color: r.color, trazo: r.trazo_svg });

export async function listarZonas() {
  const { rows } = await query("SELECT * FROM zonas ORDER BY orden, nombre");
  return rows.map(zonaDto);
}

export async function obtenerZona(id) {
  const { rows } = await query("SELECT * FROM zonas WHERE id = $1", [id]);
  if (!rows.length) throw notFound("Zona no encontrada");
  return zonaDto(rows[0]);
}

export async function listarTestimonios() {
  const { rows } = await query("SELECT texto, nombre, rol FROM testimonios ORDER BY orden, id");
  return rows;
}

export async function listarFaq() {
  const { rows } = await query("SELECT pregunta, respuesta FROM faq ORDER BY orden, id");
  return rows;
}

/** Devuelve los parámetros de la calculadora (las claves stats_* son internas). */
export async function obtenerConfig() {
  const { rows } = await query("SELECT clave, valor FROM config WHERE clave NOT LIKE 'stats\\_%'");
  return Object.fromEntries(rows.map(r => [r.clave, Number(r.valor)]));
}

/**
 * Cifras del hero: base de la comunidad + usuarios reales (sin los de demo)
 * y CO₂ evitado por las reservaciones confirmadas.
 */
export async function obtenerStats() {
  const { rows } = await query(`
    SELECT
      (SELECT valor FROM config WHERE clave = 'stats_estudiantes')   AS base_est,
      (SELECT valor FROM config WHERE clave = 'stats_conductores')   AS base_cond,
      (SELECT valor FROM config WHERE clave = 'stats_co2_toneladas') AS base_co2,
      (SELECT valor FROM config WHERE clave = 'co2PorLitro')         AS co2_litro,
      (SELECT count(*) FROM users WHERE NOT es_demo AND rol = 'pasajero') AS est,
      (SELECT count(*) FROM users WHERE NOT es_demo AND rol = 'conductor') AS cond,
      (SELECT COALESCE(sum(z.km * 2 / 14.0), 0)
         FROM reservas r JOIN raites ra ON ra.id = r.raite_id JOIN zonas z ON z.id = ra.zona_id
        WHERE r.estado = 'confirmada' AND r.user_id IS NOT NULL) AS litros`);
  const s = rows[0];
  return {
    estudiantes: Number(s.base_est) + Number(s.est),
    conductores: Number(s.base_cond) + Number(s.cond),
    co2Toneladas: Math.round((Number(s.base_co2) + (Number(s.litros) * Number(s.co2_litro)) / 1000) * 10) / 10
  };
}
