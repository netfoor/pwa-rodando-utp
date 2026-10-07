/**
 * Prepara la base de pruebas una vez: migraciones + seed (idempotentes).
 */
import { migrate } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";
import { pool } from "../src/db/pool.js";

export default async function setup() {
  await migrate();
  await seed();
  await pool.end();
}
