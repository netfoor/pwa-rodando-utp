/**
 * Configuración centralizada: lee variables de entorno (con dotenv),
 * aplica valores por defecto seguros para desarrollo y valida las críticas.
 */
import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

if (isProd && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET es obligatorio en producción");
}

export const env = {
  isProd,
  isTest,
  port: Number(process.env.PORT) || 3000,
  // SSL a Postgres: por defecto solo en producción (Render); DATABASE_SSL=false lo desactiva (docker-compose).
  databaseSsl: process.env.DATABASE_SSL ? process.env.DATABASE_SSL === "true" : isProd,
  databaseUrl: process.env.DATABASE_URL || "postgres://rodando:rodando@localhost:5432/rodando",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-no-usar-en-produccion",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  // Lista separada por comas; vacío = mismo origen únicamente (el frontend se sirve desde Express).
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean),
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || "",
    privateKey: process.env.VAPID_PRIVATE_KEY || "",
    subject: process.env.VAPID_SUBJECT || "mailto:hola@rodandoutp.mx"
  },
  seedPassword: process.env.SEED_PASSWORD || "Demo1234!",
  version: process.env.npm_package_version || "1.0.0"
};
