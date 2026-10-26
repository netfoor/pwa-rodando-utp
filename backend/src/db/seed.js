/**
 * Seed idempotente: carga zonas, raites, testimonios, FAQ, config, un admin y
 * conductores de ejemplo. Puede ejecutarse en cada arranque sin duplicar datos.
 */
import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";
import { pool, withTransaction } from "./pool.js";
import { env } from "../config/env.js";
import { ZONAS, CONDUCTORES, RAITES, TESTIMONIOS, FAQ, CONFIG } from "./seed-data.js";

/** Inserta los datos de ejemplo. @returns {Promise<void>} */
export async function seed() {
  const hash = await bcrypt.hash(env.seedPassword, 10);

  await withTransaction(async db => {
    for (const [i, z] of ZONAS.entries()) {
      await db.query(
        `INSERT INTO zonas (id, nombre, km, x, y, color, trazo_svg, orden, lat, lng, trazo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET nombre=$2, km=$3, x=$4, y=$5, color=$6, trazo_svg=$7, orden=$8,
           lat=$9, lng=$10, trazo=$11`,
        [z.id, z.nombre, z.km, z.x, z.y, z.color, z.trazo, i, z.lat, z.lng, JSON.stringify(z.ruta)]
      );
    }

    for (const [k, v] of Object.entries(CONFIG)) {
      // No pisa valores que un admin haya cambiado.
      await db.query("INSERT INTO config (clave, valor) VALUES ($1,$2) ON CONFLICT (clave) DO NOTHING", [k, v]);
    }

    await db.query(
      `INSERT INTO users (nombre, correo, password_hash, rol, carrera, cuatrimestre, es_demo)
       VALUES ('Administración Rodando', 'admin@utpuebla.edu.mx', $1, 'admin', 'Administración', NULL, true)
       ON CONFLICT (correo) DO NOTHING`, [hash]);

    const driverIds = {};
    for (const [key, c] of Object.entries(CONDUCTORES)) {
      const { rows } = await db.query(
        `INSERT INTO users (nombre, correo, password_hash, rol, carrera, cuatrimestre, es_demo)
         VALUES ($1,$2,$3,'conductor',$4,$5,true)
         ON CONFLICT (correo) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
        [c.nombre, c.correo, hash, c.carrera, c.cuatri]);
      driverIds[key] = rows[0].id;
      await db.query(
        `INSERT INTO drivers (user_id, auto, rating, viajes, verificado) VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (user_id) DO NOTHING`, [rows[0].id, c.auto, c.rating, c.viajes]);
    }

    // Raites con id fijo: solo se insertan si no existen (no se duplican ni se pisan ediciones).
    let nuevos = 0;
    let seq = 0; // contador para códigos determinísticos de reservas de ejemplo
    for (const r of RAITES) {
      const res = await db.query(
        `INSERT INTO raites (id, zona_id, driver_id, tipo, hora, dias, asientos, aportacion, paradas)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [r.id, r.zona, driverIds[r.cond], r.tipo, r.hora, r.dias, r.asientos, r.aportacion, r.paradas]);
      if (res.rowCount) {
        nuevos++;
        // Lugares ya apartados por "otros estudiantes" (ocupación simulada del prototipo).
        for (const dia of r.dias) {
          for (let n = 0; n < r.ocupados; n++) {
            await db.query(
              `INSERT INTO reservas (codigo, raite_id, user_id, dia, parada, nombre)
               VALUES ($1,$2,NULL,$3,$4,'Estudiante UTP') ON CONFLICT (codigo) DO NOTHING`,
              [`RU-S${(seq++).toString(36).toUpperCase().padStart(3, "0")}`, r.id, dia, r.paradas[0]]);
          }
        }
      }
    }
    if (nuevos) await db.query("SELECT setval(pg_get_serial_sequence('raites','id'), (SELECT MAX(id) FROM raites))");

    if (!(await db.query("SELECT 1 FROM testimonios LIMIT 1")).rowCount) {
      for (const [i, t] of TESTIMONIOS.entries())
        await db.query("INSERT INTO testimonios (texto, nombre, rol, orden) VALUES ($1,$2,$3,$4)", [t.texto, t.nombre, t.rol, i]);
    }
    if (!(await db.query("SELECT 1 FROM faq LIMIT 1")).rowCount) {
      for (const [i, f] of FAQ.entries())
        await db.query("INSERT INTO faq (pregunta, respuesta, orden) VALUES ($1,$2,$3)", [f.pregunta, f.respuesta, i]);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(() => console.log("Seed completado"))
    .then(() => pool.end())
    .catch(err => { console.error(err); process.exit(1); });
}
