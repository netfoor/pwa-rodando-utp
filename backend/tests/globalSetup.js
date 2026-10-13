/**
 * Prepara la base de pruebas una vez: la reinicia (solo si su nombre termina en
 * "_test", por seguridad), aplica migraciones y carga el seed.
 */
import { migrate } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";
import { pool } from "../src/db/pool.js";

export default async function setup() {
  const { rows } = await pool.query("SELECT current_database() AS db");
  if (!rows[0].db.endsWith("_test")) throw new Error(`Las pruebas solo corren en bases *_test (actual: ${rows[0].db})`);
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await migrate();
  await seed();
  await pool.end();
}
