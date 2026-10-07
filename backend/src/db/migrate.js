/**
 * Ejecutor de migraciones SQL. Aplica en orden alfabético los archivos de
 * db/migrations que aún no estén registrados en la tabla schema_migrations.
 * Usa un advisory lock para que varias instancias no migren a la vez.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/** Aplica las migraciones pendientes. @returns {Promise<string[]>} nombres aplicados */
export async function migrate() {
  const client = await pool.connect();
  const applied = [];
  try {
    await client.query("SELECT pg_advisory_lock(727001)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())");
    const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map(r => r.name));
    for (const file of (await readdir(dir)).filter(f => f.endsWith(".sql")).sort()) {
      if (done.has(file)) continue;
      await client.query("BEGIN");
      try {
        await client.query(await readFile(path.join(dir, file), "utf8"));
        await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(727001)").catch(() => {});
    client.release();
  }
  return applied;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then(a => console.log(a.length ? `Migraciones aplicadas: ${a.join(", ")}` : "Base de datos al día"))
    .then(() => pool.end())
    .catch(err => { console.error(err); process.exit(1); });
}
