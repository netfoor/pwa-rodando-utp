/**
 * Seguimiento en vivo de un raite: estado del viaje del día, última posición del
 * conductor, llegada estimada sobre el trazo de la ruta y solicitudes de lugar
 * que el conductor acepta o rechaza.
 */
import { query, withTransaction } from "../db/pool.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors.js";
import { diaSemanaMx } from "../utils/fecha.js";
import * as push from "./push.service.js";
import { generarCodigo } from "../utils/codigo.js";

export const UTP = { lat: 19.0583869, lng: -98.1545312, nombre: "UTP · Puerta principal" };
const VELOCIDAD_MIN = 3.5;
const VELOCIDAD_MAX = 32;
const VIGENCIA_MS = 90 * 1000;

const SELECT = `
  SELECT r.id, r.zona_id, r.tipo, r.hora, r.dias, r.asientos, r.aportacion, r.paradas, r.activo, r.driver_id,
         u.nombre AS c_nombre, d.auto, d.rating, d.verificado,
         z.nombre AS z_nombre, z.color AS z_color, z.lat AS z_lat, z.lng AS z_lng, z.trazo AS z_trazo
    FROM raites r
    JOIN users u ON u.id = r.driver_id
    JOIN drivers d ON d.user_id = r.driver_id
    JOIN zonas z ON z.id = r.zona_id`;

export const fechaMx = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

const diaDeFecha = fecha => diaSemanaMx(new Date(fecha + "T12:00:00-06:00"));
const redondear = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Distancia en metros entre dos puntos [lat, lng]. */
export function distanciaMetros([lat1, lng1], [lat2, lng2]) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Acumulado de distancias y longitud total de un trazo. */
function medir(ruta) {
  const acum = [0];
  for (let i = 1; i < ruta.length; i++) acum.push(acum[i - 1] + distanciaMetros(ruta[i - 1], ruta[i]));
  return { acum, total: acum[acum.length - 1] || 0 };
}

/** Punto sobre la ruta a una distancia dada desde el origen. */
function puntoEn(ruta, acum, s) {
  if (!ruta.length) return null;
  if (s <= 0) return ruta[0];
  for (let i = 1; i < ruta.length; i++) {
    if (acum[i] >= s) {
      const tramo = acum[i] - acum[i - 1] || 1;
      const t = (s - acum[i - 1]) / tramo;
      return [ruta[i - 1][0] + (ruta[i][0] - ruta[i - 1][0]) * t, ruta[i - 1][1] + (ruta[i][1] - ruta[i - 1][1]) * t];
    }
  }
  return ruta[ruta.length - 1];
}

/** Distancia recorrida y desvío del punto más cercano del trazo. */
function proyectar(ruta, acum, pos) {
  let mejor = { s: 0, desvio: Infinity };
  for (let i = 1; i < ruta.length; i++) {
    const a = ruta[i - 1], b = ruta[i];
    const x = pos[0], y = pos[1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
    const p = [a[0] + dx * t, a[1] + dy * t];
    const d = distanciaMetros(pos, p);
    if (d < mejor.desvio) mejor = { s: acum[i - 1] + (acum[i] - acum[i - 1]) * t, desvio: d };
  }
  return mejor;
}

async function cargarRaite(raiteId) {
  const { rows } = await query(SELECT + " WHERE r.id = $1", [raiteId]);
  if (!rows.length) throw notFound("Raite no encontrado");
  const r = rows[0];
  const trazo = Array.isArray(r.z_trazo) ? r.z_trazo : r.z_lat != null ? [[r.z_lat, r.z_lng], [UTP.lat, UTP.lng]] : [];
  const ruta = r.tipo === "ida" ? trazo : [...trazo].reverse();
  return { ...r, ruta };
}

function resumen(r) {
  return {
    id: r.id, tipo: r.tipo, hora: r.hora, dias: r.dias, asientos: r.asientos, aportacion: r.aportacion,
    paradas: r.paradas,
    zona: { id: r.zona_id, nombre: r.z_nombre, color: r.z_color, lat: r.z_lat, lng: r.z_lng },
    conductor: { id: r.driver_id, nombre: r.c_nombre, auto: r.auto, rating: Number(r.rating), verificado: r.verificado }
  };
}

/** Fracción del trazo (0–1) donde se ubica una parada del viaje. */
export function fraccionParada(paradas, parada, tipo) {
  const n = paradas.length;
  if (!parada || parada === UTP.nombre) return tipo === "ida" ? 1 : 1;
  const orden = tipo === "ida" ? paradas : [...paradas].reverse();
  const i = orden.indexOf(parada);
  if (i < 0) return null;
  return (i + 1) / (n + 1);
}

async function viajeDe(raiteId, fecha) {
  const { rows } = await query("SELECT * FROM viajes WHERE raite_id = $1 AND fecha = $2", [raiteId, fecha]);
  return rows[0] || null;
}

async function exigirDueno(raiteId, user) {
  const r = await cargarRaite(raiteId);
  if (r.driver_id !== user.id && user.rol !== "admin") throw forbidden("Solo el conductor del raite puede compartir su ubicación");
  return r;
}

async function participantes(raiteId, dia) {
  const { rows } = await query(
    `SELECT codigo, user_id, parada, estado FROM reservas
      WHERE raite_id = $1 AND dia = $2 AND estado IN ('confirmada','pendiente')
      ORDER BY created_at`, [raiteId, dia]);
  return rows;
}

/** ¿El usuario puede ver la posición del auto? Conductor y participantes del viaje. */
export async function puedeVer(raiteId, fecha, user) {
  if (!user) return false;
  const r = await cargarRaite(raiteId);
  if (r.driver_id === user.id || user.rol === "admin") return true;
  const dia = diaDeFecha(fecha);
  const { rowCount } = await query(
    `SELECT 1 FROM reservas WHERE raite_id = $1 AND dia = $2 AND user_id = $3
       AND estado IN ('confirmada','pendiente')`, [raiteId, dia, user.id]);
  return rowCount > 0;
}

function calcular(r, viaje, usuarioPos, fraccionDestino) {
  if (!viaje?.lat || !r.ruta.length) return null;
  const { acum, total } = medir(r.ruta);
  const { s, desvio } = proyectar(r.ruta, acum, [viaje.lat, viaje.lng]);
  const destino = total * Math.min(Math.max(fraccionDestino ?? 1, 0), 1);
  const restante = Math.max(destino - s, 0);
  const edad = viaje.actualizado_en ? Date.now() - new Date(viaje.actualizado_en).getTime() : Infinity;
  const vigente = edad < VIGENCIA_MS;
  const velocidad = viaje.velocidad_ms >= VELOCIDAD_MIN && viaje.velocidad_ms <= VELOCIDAD_MAX ? viaje.velocidad_ms : 7;
  return {
    lat: viaje.lat, lng: viaje.lng, precision: viaje.precision_m, velocidad: viaje.velocidad_ms, rumbo: viaje.rumbo,
    actualizadoEn: viaje.actualizado_en, vigente, desvio: redondear(desvio, 0),
    distanciaKm: redondear(restante / 1000, 2),
    etaMin: vigente ? Math.max(1, Math.ceil((restante / velocidad) * 1.15 / 60)) : null,
    avance: redondear(total ? s / total : 0, 3)
  };
}

/** Estado completo de la vista en vivo para un usuario (o anónimo). */
export async function estado(user, raiteId, { fecha } = {}) {
  const r = await cargarRaite(raiteId);
  if (!r.activo) throw notFound("Ese raite está pausado");
  fecha = fecha || fechaMx();
  const dia = diaDeFecha(fecha);
  const viaje = await viajeDe(raiteId, fecha);
  const gente = await participantes(raiteId, dia);
  const participa = Boolean(user) && (r.driver_id === user.id || user.rol === "admin"
    || gente.some(g => g.user_id === user.id));
  const mia = user ? gente.find(g => g.user_id === user.id) : null;
  const esConductor = Boolean(user) && r.driver_id === user.id;

  const fraccion = esConductor ? 1 : fraccionParada(r.paradas, mia?.parada, r.tipo) ?? 1;
  const posicion = participa ? calcular(r, viaje, user, fraccion) : null;
  const destino = puntoEn(r.ruta, medir(r.ruta).acum, medir(r.ruta).total * (fraccion ?? 1));

  return {
    raite: {
      ...resumen(r),
      libres: Math.max(r.asientos - gente.filter(g => g.estado === "confirmada").length, 0),
      ocupados: gente.filter(g => g.estado === "confirmada").length
    },
    fecha, dia, hoy: fecha === fechaMx(),
    estadoViaje: viaje?.estado ?? "programado",
    iniciadoEn: viaje?.iniciado_en ?? null,
    actualizadoEn: viaje?.actualizado_en ?? null,
    compartiendo: Boolean(viaje?.lat) && viaje?.estado !== "finalizado",
    ruta: r.ruta,
    origen: r.ruta[0] ?? null,
    campus: r.tipo === "ida" ? [UTP.lat, UTP.lng] : r.ruta[r.ruta.length - 1] ?? null,
    puntoEncuentro: destino,
    miParada: mia?.parada ?? null,
    miReserva: mia ? { codigo: mia.codigo, estado: mia.estado, parada: mia.parada } : null,
    esConductor,
    puedeVer: participa,
    posicion,
    participantes: gente.filter(g => g.estado === "confirmada").length,
    solicitudesPendientes: gente.filter(g => g.estado === "pendiente").length
  };
}

/** El conductor inicia (o retoma) el seguimiento del viaje de hoy. */
export async function iniciar(user, raiteId, { fecha } = {}) {
  const r = await exigirDueno(raiteId, user);
  fecha = fecha || fechaMx();
  const dia = diaDeFecha(fecha);
  if (!r.dias.includes(dia)) throw badRequest("El raite no sale ese día");
  const { rows } = await query(
    `INSERT INTO viajes (raite_id, fecha, estado) VALUES ($1,$2,'en_camino')
     ON CONFLICT (raite_id, fecha) DO UPDATE SET
       estado = CASE WHEN viajes.estado = 'finalizado' THEN 'en_camino' ELSE viajes.estado END,
       finalizado_en = CASE WHEN viajes.estado = 'finalizado' THEN NULL ELSE viajes.finalizado_en END
     RETURNING *`, [raiteId, fecha]);
  return { viaje: rows[0], fecha };
}

/** Actualiza la última posición del auto (solo conductor) y devuelve la estimación. */
export async function actualizarPosicion(user, raiteId, { lat, lng, precision, velocidad, rumbo, fecha }) {
  const r = await exigirDueno(raiteId, user);
  fecha = fecha || fechaMx();
  const viaje = await viajeDe(raiteId, fecha);
  if (!viaje) throw badRequest("Primero inicia el seguimiento del viaje");
  if (viaje.estado === "finalizado") throw badRequest("El viaje ya finalizó");
  if (precision > 30) throw badRequest("La precisión del GPS es insuficiente (más de 30 m)");

  const { rows } = await query(
    `UPDATE viajes SET lat=$3, lng=$4, precision_m=$5, velocidad_ms=$6, rumbo=$7, actualizado_en=now()
      WHERE raite_id=$1 AND fecha=$2 RETURNING *`,
    [raiteId, fecha, lat, lng, precision ?? null, velocidad ?? null, rumbo ?? null]);
  const pos = calcular(r, rows[0], user, 1);
  return { viaje: rows[0], posicion: pos, fecha };
}

/** Cambia el estado del viaje: en_camino, recogiendo, en_ruta o finalizado. */
export async function cambiarEstado(user, raiteId, { estado, fecha }) {
  await exigirDueno(raiteId, user);
  fecha = fecha || fechaMx();
  const viaje = await viajeDe(raiteId, fecha);
  if (!viaje) throw badRequest("Primero inicia el seguimiento del viaje");
  if (estado === "finalizado") {
    const { rows } = await query(
      `UPDATE viajes SET estado='finalizado', finalizado_en=now(), lat=NULL, lng=NULL, precision_m=NULL,
              velocidad_ms=NULL, rumbo=NULL, actualizado_en=now()
        WHERE raite_id=$1 AND fecha=$2 RETURNING *`, [raiteId, fecha]);
    return { viaje: rows[0], fecha };
  }
  const { rows } = await query(
    `UPDATE viajes SET estado=$3, finalizado_en=NULL WHERE raite_id=$1 AND fecha=$2 RETURNING *`,
    [raiteId, fecha, estado]);
  return { viaje: rows[0], fecha };
}

/** El pasajero pide un lugar desde la vista en vivo (queda pendiente de aceptación). */
export async function solicitar(user, raiteId, { parada, nombre, fecha }) {
  const r = await cargarRaite(raiteId);
  if (!r.activo) throw notFound("Ese raite está pausado");
  if (r.driver_id === user.id) throw badRequest("No puedes solicitar lugar en tu propio raite");
  fecha = fecha || fechaMx();
  const dia = diaDeFecha(fecha);
  if (!r.dias.includes(dia)) throw badRequest("Ese día no hay viaje para este raite");
  if (![...r.paradas, UTP.nombre].includes(parada)) throw badRequest("Esa parada no pertenece al raite");

  const nombreFinal = nombre || (await query("SELECT nombre FROM users WHERE id=$1", [user.id])).rows[0]?.nombre || "Pasajero";

  const { rowCount } = await query(
    `SELECT 1 FROM reservas WHERE raite_id=$1 AND user_id=$2 AND dia=$3
       AND estado IN ('confirmada','pendiente')`, [raiteId, user.id, dia]);
  if (rowCount) throw conflict("SOLICITUD_DUPLICADA", "Ya tienes una solicitud o reserva en este raite hoy");

  let creada;
  for (let intento = 0; intento < 5 && !creada; intento++) {
    const ins = await query(
      `INSERT INTO reservas (codigo, raite_id, user_id, dia, parada, nombre, estado)
       VALUES ($1,$2,$3,$4,$5,$6,'pendiente')
       ON CONFLICT (codigo) DO NOTHING RETURNING codigo, estado, parada, dia`,
      [generarCodigo(), raiteId, user.id, dia, parada, nombreFinal]);
    creada = ins.rows[0];
  }
  if (!creada) throw conflict("CODIGO_NO_DISPONIBLE", "No se pudo generar el código, intenta de nuevo");
  push.enviar({
    titulo: "Solicitud de lugar en vivo 🚗",
    mensaje: `${nombreFinal} quiere subir en ${parada}.`,
    url: `/vivo.html?raite=${raiteId}`
  }, r.driver_id).catch(() => {});
  return { ...creada, fecha, nombre: nombreFinal, raiteId };
}

/** Solicitudes pendientes del viaje de hoy (solo conductor). */
export async function solicitudes(user, raiteId, { fecha } = {}) {
  const r = await exigirDueno(raiteId, user);
  fecha = fecha || fechaMx();
  const dia = diaDeFecha(fecha);
  const viaje = await viajeDe(raiteId, fecha);
  const { rows } = await query(
    `SELECT v.codigo, v.nombre, v.parada, v.created_at AS "creada", u.carrera, u.cuatrimestre
       FROM reservas v LEFT JOIN users u ON u.id = v.user_id
      WHERE v.raite_id=$1 AND v.dia=$2 AND v.estado='pendiente'
      ORDER BY v.created_at`, [raiteId, dia]);
  const { acum, total } = medir(r.ruta);
  const coche = viaje?.lat ? proyectar(r.ruta, acum, [viaje.lat, viaje.lng]).s : 0;
  const velocidad = viaje?.velocidad_ms >= VELOCIDAD_MIN ? viaje.velocidad_ms : 7;
  return rows.map(s => {
    const f = fraccionParada(r.paradas, s.parada, r.tipo) ?? 1;
    const faltan = Math.max(total * f - coche, 0);
    return {
      ...s,
      distanciaKm: redondear(faltan / 1000, 1),
      etaMin: viaje?.lat ? Math.max(1, Math.ceil((faltan / velocidad) * 1.15 / 60)) : null
    };
  });
}

/** Acepta o rechaza una solicitud pendiente; aceptar consume un asiento real. */
export async function responderSolicitud(user, raiteId, codigo, accion, fecha = fechaMx()) {
  await exigirDueno(raiteId, user);
  const dia = diaDeFecha(fecha);

  const datos = await withTransaction(async db => {
    const { rows: [reserva] } = await db.query(
      `SELECT id, user_id, parada, nombre, estado FROM reservas
        WHERE codigo=$1 AND raite_id=$2 AND dia=$3 FOR UPDATE`, [codigo, raiteId, dia]);
    if (!reserva) throw notFound("Solicitud no encontrada");
    if (reserva.estado !== "pendiente") throw badRequest("Esa solicitud ya fue atendida");

    if (accion === "rechazar") {
      await db.query("UPDATE reservas SET estado='rechazada' WHERE id=$1", [reserva.id]);
      return { ...reserva, estado: "rechazada" };
    }
    const { rows: [raite] } = await db.query("SELECT asientos FROM raites WHERE id=$1 FOR UPDATE", [raiteId]);
    const { rows: [{ n }] } = await db.query(
      "SELECT count(*)::int AS n FROM reservas WHERE raite_id=$1 AND dia=$2 AND estado='confirmada'", [raiteId, dia]);
    if (n >= raite.asientos) throw conflict("RAITE_LLENO", "El raite ya no tiene lugares libres hoy");
    await db.query("UPDATE reservas SET estado='confirmada' WHERE id=$1", [reserva.id]);
    return { ...reserva, estado: "confirmada" };
  });

  push.enviar({
    titulo: datos.estado === "confirmada" ? "¡Tu lugar quedó apartado! 🎉" : "Solicitud no aceptada",
    mensaje: datos.estado === "confirmada"
      ? `Código ${codigo}. Te subes en ${datos.parada}.`
      : "El conductor no pudo aceptar tu solicitud. Busca otro raite disponible.",
    url: `/vivo.html?raite=${raiteId}`
  }, datos.user_id).catch(() => {});
  return { codigo, estado: datos.estado, parada: datos.parada, fecha };
}

/** Aviso del pasajero al conductor (ya está en el punto de encuentro). */
export async function avisar(user, raiteId) {
  const r = await cargarRaite(raiteId);
  const fecha = fechaMx(), dia = diaDeFecha(fecha);
  const mia = await query(
    `SELECT parada FROM reservas WHERE raite_id=$1 AND user_id=$2 AND dia=$3 AND estado='confirmada'`,
    [raiteId, user.id, dia]);
  if (!mia.rowCount) throw forbidden("Necesitas una reserva confirmada para avisar");
  push.enviar({
    titulo: "Tu pasajero ya te espera 📍",
    mensaje: `${user.nombre || "Un pasajero"} está en ${mia.rows[0].parada}.`,
    url: `/vivo.html?raite=${raiteId}`
  }, r.driver_id).catch(() => {});
  return { ok: true, parada: mia.rows[0].parada };
}

/** Métricas internas del viaje (para pruebas y difusión). */
export async function resumenViaje(raiteId, fecha = fechaMx()) {
  const r = await cargarRaite(raiteId);
  const viaje = await viajeDe(raiteId, fecha);
  return { viaje, ruta: r.ruta, total: medir(r.ruta).total };
}

/** Estimación personalizada para un suscriptor del canal en vivo. */
export async function posicionParaUsuario(raiteId, fecha, user) {
  const r = await cargarRaite(raiteId);
  const viaje = await viajeDe(raiteId, fecha);
  const dia = diaDeFecha(fecha);
  let fraccion = 1;
  if (user && r.driver_id !== user.id && user.rol !== "admin") {
    const { rows } = await query(
      `SELECT parada FROM reservas WHERE raite_id=$1 AND user_id=$2 AND dia=$3
         AND estado IN ('confirmada','pendiente')`, [raiteId, user.id, dia]);
    fraccion = fraccionParada(r.paradas, rows[0]?.parada, r.tipo) ?? 1;
  }
  return { estado: viaje?.estado ?? "programado", posicion: calcular(r, viaje, user, fraccion) };
}
