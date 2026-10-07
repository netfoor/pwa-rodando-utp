/**
 * Health check: confirma que el proceso responde y que la base de datos contesta.
 */
import { query } from "../db/pool.js";
import { env } from "../config/env.js";

export const health = async (req, res) => {
  let db = false;
  try { await query("SELECT 1"); db = true; } catch { /* db = false */ }
  res.status(db ? 200 : 503).json({ status: db ? "ok" : "degradado", db, version: env.version, uptime: Math.round(process.uptime()) });
};
