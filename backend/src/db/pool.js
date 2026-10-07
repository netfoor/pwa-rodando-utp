/**
 * Pool de conexiones a PostgreSQL. En producción (Render) activa SSL por defecto sin
 * verificar el certificado, como exige la base de datos administrada.
 */
import pg from "pg";
import { env } from "../config/env.js";

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10
});

/** Atajo para consultas simples. @returns {Promise<pg.QueryResult>} */
export const query = (text, params) => pool.query(text, params);

/**
 * Ejecuta `fn(client)` dentro de una transacción (BEGIN/COMMIT, ROLLBACK si falla).
 * @template T
 * @param {(client: pg.PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
