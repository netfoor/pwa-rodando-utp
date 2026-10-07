/**
 * Solicitudes para ser conductor (formulario público "Registro de conductor")
 * y su revisión por parte de un administrador.
 */
import { query, withTransaction } from "../db/pool.js";
import { badRequest, notFound, conflict } from "../utils/errors.js";

export async function crearSolicitud(d) {
  if (!(await query("SELECT 1 FROM zonas WHERE id = $1", [d.zona])).rowCount) throw badRequest("La zona no existe");
  const { rows } = await query(
    `INSERT INTO solicitudes_conductor (nombre, correo, carrera, auto, zona_id, hora, lugares)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, estado`,
    [d.nombre, d.correo, d.carrera ?? null, d.auto, d.zona, d.hora, d.lugares]);
  const km = (await query("SELECT km FROM zonas WHERE id = $1", [d.zona])).rows[0].km;
  // Misma sugerencia que el formulario original: ~$1.8 por km, redondeada a múltiplos de 5.
  return { ...rows[0], aportacionSugerida: Math.max(10, Math.round(km * 1.8 / 5) * 5) };
}

export async function listarSolicitudes(estado) {
  const { rows } = await query(
    `SELECT id, nombre, correo, carrera, auto, zona_id AS zona, hora, lugares, estado, created_at AS "creada"
       FROM solicitudes_conductor WHERE ($1::text IS NULL OR estado = $1) ORDER BY created_at DESC`, [estado ?? null]);
  return rows;
}

/**
 * Aprueba una solicitud. Si ya existe una cuenta con ese correo, la convierte
 * en conductor verificado y publica su raite de ida; si no, solo marca la solicitud.
 */
export async function aprobar(id) {
  return withTransaction(async db => {
    const { rows } = await db.query("SELECT * FROM solicitudes_conductor WHERE id = $1 FOR UPDATE", [id]);
    const s = rows[0];
    if (!s) throw notFound("Solicitud no encontrada");
    if (s.estado === "aprobada") throw conflict("YA_APROBADA", "La solicitud ya fue aprobada");

    await db.query("UPDATE solicitudes_conductor SET estado = 'aprobada' WHERE id = $1", [id]);
    const u = (await db.query("SELECT id, rol FROM users WHERE correo = $1", [s.correo.toLowerCase()])).rows[0];
    let raiteId = null;
    if (u) {
      if (u.rol === "pasajero") await db.query("UPDATE users SET rol = 'conductor' WHERE id = $1", [u.id]);
      await db.query(
        `INSERT INTO drivers (user_id, auto, verificado) VALUES ($1,$2,true)
         ON CONFLICT (user_id) DO UPDATE SET verificado = true`, [u.id, s.auto]);
      const r = await db.query(
        `INSERT INTO raites (zona_id, driver_id, tipo, hora, dias, asientos, aportacion, paradas)
         SELECT $1::text,$2::int,'ida',$3::char(5),'{0,1,2,3,4}'::smallint[],$4::smallint, GREATEST(10, ROUND(km * 1.8 / 5) * 5), ARRAY[nombre]
           FROM zonas WHERE id = $1 RETURNING id`, [s.zona_id, u.id, s.hora, s.lugares]);
      raiteId = r.rows[0].id;
    }
    return { id, estado: "aprobada", usuarioExiste: Boolean(u), raiteId };
  });
}
