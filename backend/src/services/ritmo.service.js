/**
 * Ritmo (Subproducto 5 de Israel): detecta el patrón de viaje de un estudiante a
 * partir de sus reservas, sugiere el raite que mejor lo cubre, arma grupos
 * recurrentes que generan las reservas de todos sus días y mide la demanda.
 */
import { query, withTransaction } from "../db/pool.js";
import { generarCodigo } from "../utils/codigo.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors.js";
import { PARADA_UTP } from "./reservas.service.js";
import * as push from "./push.service.js";

const minutos = hora => { const [h, m] = String(hora).split(":").map(Number); return h * 60 + m; };

/** Patrón del usuario: zona, sentido y franja de sus reservas, y el raite sugerido. */
export async function patron(user) {
  const { rows } = await query(
    `SELECT r.zona_id AS "zonaId", r.tipo, r.hora, res.dia
       FROM reservas res JOIN raites r ON r.id = res.raite_id
      WHERE res.user_id = $1 AND res.estado IN ('confirmada','cancelada')`, [user.id]);
  if (!rows.length) return { viajes: 0, patrones: [], sugerencia: null };

  const grupos = new Map();
  for (const v of rows) {
    const franja = Math.floor(minutos(v.hora) / 30) * 30; // franjas de media hora
    const k = `${v.zonaId}|${v.tipo}|${franja}`;
    const g = grupos.get(k) || { zonaId: v.zonaId, tipo: v.tipo, franja, viajes: 0, dias: new Set() };
    g.viajes++; g.dias.add(v.dia);
    grupos.set(k, g);
  }
  const patrones = [...grupos.values()]
    .map(g => ({ ...g, dias: [...g.dias].sort(), franja: `${String(g.franja / 60 | 0).padStart(2, "0")}:${String(g.franja % 60).padStart(2, "0")}`,
      porcentaje: Math.round(g.viajes / rows.length * 100) }))
    .sort((a, b) => b.viajes - a.viajes);

  const top = patrones[0];
  const { rows: candidatos } = await query(
    `SELECT r.id, r.hora, r.dias, r.asientos, r.paradas, u.nombre AS conductor,
            (SELECT count(DISTINCT user_id)::int FROM reservas x WHERE x.raite_id = r.id AND x.estado = 'confirmada' AND x.user_id <> $3) AS companeros
       FROM raites r JOIN users u ON u.id = r.driver_id
      WHERE r.activo AND r.zona_id = $1 AND r.tipo = $2 AND r.driver_id <> $3`, [top.zonaId, top.tipo, user.id]);
  const objetivo = minutos(top.franja) + 15;
  const sugerencia = candidatos
    .map(c => ({ raiteId: c.id, hora: c.hora, conductor: c.conductor, paradas: c.paradas, companeros: c.companeros,
      diasCubiertos: top.dias.filter(d => c.dias.includes(d)), diferenciaMin: Math.abs(minutos(c.hora) - objetivo) }))
    .sort((a, b) => b.diasCubiertos.length - a.diasCubiertos.length || a.diferenciaMin - b.diferenciaMin)[0] || null;
  return { viajes: rows.length, patrones, sugerencia };
}

/** Demanda por zona, sentido y hora: lugares ocupados contra lugares ofrecidos en la semana. */
export async function demanda() {
  const { rows } = await query(
    `SELECT z.nombre AS zona, r.tipo, r.hora,
            sum(r.asientos * cardinality(r.dias))::int AS ofrecidos,
            (SELECT count(*)::int FROM reservas x JOIN raites y ON y.id = x.raite_id
              WHERE y.zona_id = r.zona_id AND y.tipo = r.tipo AND y.hora = r.hora AND x.estado = 'confirmada') AS ocupados
       FROM raites r JOIN zonas z ON z.id = r.zona_id
      WHERE r.activo
      GROUP BY z.nombre, r.zona_id, r.tipo, r.hora
      ORDER BY r.tipo, r.hora`);
  return rows.map(r => ({ ...r, ocupacion: r.ofrecidos ? Math.round(r.ocupados / r.ofrecidos * 100) : 0 }));
}

/**
 * Confirma un grupo: en una transacción bloquea el raite, crea las reservas de los
 * días elegidos (sin duplicar las que ya existan) y registra el grupo.
 */
export async function crearGrupo(user, { raiteId, dias, parada }) {
  return withTransaction(async db => {
    const { rows: [raite] } = await db.query(
      "SELECT id, driver_id, dias, asientos, paradas, activo FROM raites WHERE id = $1 FOR UPDATE", [raiteId]);
    if (!raite || !raite.activo) throw notFound("Raite no encontrado");
    if (raite.driver_id === user.id) throw badRequest("No puedes formar grupo en tu propio raite");
    if (![...raite.paradas, PARADA_UTP].includes(parada)) throw badRequest("Esa parada no pertenece al raite");
    const fuera = dias.filter(d => !raite.dias.includes(d));
    if (fuera.length) throw badRequest("El raite no sale alguno de esos días");

    const { rows: [u] } = await db.query("SELECT nombre FROM users WHERE id = $1", [user.id]);
    const reservas = [];
    for (const dia of dias) {
      const ya = await db.query(
        "SELECT codigo FROM reservas WHERE raite_id=$1 AND user_id=$2 AND dia=$3 AND estado='confirmada'", [raiteId, user.id, dia]);
      if (ya.rowCount) { reservas.push({ dia, codigo: ya.rows[0].codigo, nueva: false }); continue; }
      const { rows: [{ n }] } = await db.query(
        "SELECT count(*)::int AS n FROM reservas WHERE raite_id=$1 AND dia=$2 AND estado='confirmada'", [raiteId, dia]);
      if (n >= raite.asientos) throw conflict("RAITE_LLENO", `El raite ya no tiene lugares el día ${dia}`);
      const ins = await db.query(
        `INSERT INTO reservas (codigo, raite_id, user_id, dia, parada, nombre) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (codigo) DO NOTHING RETURNING codigo`, [generarCodigo(), raiteId, user.id, dia, parada, u.nombre]);
      if (!ins.rowCount) throw conflict("CODIGO_NO_DISPONIBLE", "No se pudo generar el código, intenta de nuevo");
      reservas.push({ dia, codigo: ins.rows[0].codigo, nueva: true });
    }
    const { rows: [grupo] } = await db.query(
      `INSERT INTO ritmo_grupos (user_id, raite_id, dias, parada) VALUES ($1,$2,$3,$4)
       RETURNING id, raite_id AS "raiteId", dias, parada, estado, creado_en AS "creadoEn"`, [user.id, raiteId, dias, parada]);
    push.enviar({ titulo: "Nuevo integrante en tu grupo", mensaje: `${u.nombre} se unió a tu raite con Ritmo.` }, raite.driver_id).catch(() => {});
    return { grupo, reservas };
  });
}

/** Grupos activos del usuario con sus compañeros y el ahorro de la semana. */
export async function misGrupos(user) {
  const { rows } = await query(
    `SELECT g.id, g.raite_id AS "raiteId", g.dias, g.parada, g.estado, r.hora, r.tipo, r.aportacion, u.nombre AS conductor,
            (SELECT array_agg(DISTINCT x.nombre) FROM reservas x
              WHERE x.raite_id = g.raite_id AND x.estado = 'confirmada' AND x.user_id <> g.user_id) AS companeros,
            (SELECT count(*)::int FROM ritmo_ausencias a WHERE a.grupo_id = g.id) AS ausencias
       FROM ritmo_grupos g JOIN raites r ON r.id = g.raite_id JOIN users u ON u.id = r.driver_id
      WHERE g.user_id = $1 AND g.estado = 'activo' ORDER BY g.id`, [user.id]);
  return rows.map(g => ({ ...g, companeros: g.companeros || [], aportacionSemanal: g.aportacion * g.dias.length }));
}

async function grupoPropio(user, id) {
  const { rows: [g] } = await query("SELECT * FROM ritmo_grupos WHERE id = $1", [id]);
  if (!g || g.estado !== "activo") throw notFound("Grupo no encontrado");
  if (g.user_id !== user.id) throw forbidden("Ese grupo no es tuyo");
  return g;
}

/** Registra que el integrante no viajará una fecha y avisa al conductor. */
export async function ausencia(user, id, { fecha, motivo }) {
  const g = await grupoPropio(user, id);
  const dia = (new Date(fecha + "T12:00:00Z").getUTCDay() + 6) % 7; // 0 = lunes
  if (!g.dias.includes(dia)) throw badRequest("Ese día no forma parte de tu grupo");
  const { rows: [a] } = await query(
    `INSERT INTO ritmo_ausencias (grupo_id, fecha, motivo) VALUES ($1,$2,$3)
     RETURNING id, fecha, motivo`, [id, fecha, motivo ?? null]);
  const { rows: [r] } = await query("SELECT driver_id, hora FROM raites WHERE id = $1", [g.raite_id]);
  push.enviar({ titulo: "Un integrante no viajará", mensaje: `Hay un lugar libre el ${fecha} en tu raite de las ${r.hora}.` }, r.driver_id).catch(() => {});
  return a;
}

/** Deja el grupo y cancela sus reservas. */
export async function salir(user, id) {
  const g = await grupoPropio(user, id);
  return withTransaction(async db => {
    await db.query("UPDATE ritmo_grupos SET estado = 'cancelado' WHERE id = $1", [id]);
    const { rowCount } = await db.query(
      `UPDATE reservas SET estado = 'cancelada' WHERE raite_id=$1 AND user_id=$2 AND dia = ANY($3) AND estado='confirmada'`,
      [g.raite_id, user.id, g.dias]);
    return { ok: true, reservasCanceladas: rowCount };
  });
}
