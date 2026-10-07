/**
 * Punto de arranque: aplica migraciones y seed (idempotentes) y abre el puerto.
 * Cierra el pool de PostgreSQL de forma ordenada con SIGTERM/SIGINT.
 */
import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { migrate } from "./db/migrate.js";
import { seed } from "./db/seed.js";

async function main() {
  const aplicadas = await migrate();
  if (aplicadas.length) console.log(`Migraciones aplicadas: ${aplicadas.join(", ")}`);
  if (process.env.SKIP_SEED !== "true") await seed();

  const server = app.listen(env.port, () => console.log(`Rodando UTP escuchando en http://localhost:${env.port}`));
  const cerrar = () => server.close(() => pool.end().then(() => process.exit(0)));
  process.on("SIGTERM", cerrar);
  process.on("SIGINT", cerrar);
}

main().catch(err => { console.error("No se pudo iniciar:", err); process.exit(1); });
