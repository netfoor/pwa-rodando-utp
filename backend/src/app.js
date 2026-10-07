/**
 * Aplicación Express: seguridad (helmet, CORS, rate limit), logs, API en /api,
 * documentación Swagger en /api/docs y el frontend estático (PWA) en la raíz.
 * No abre el puerto: eso lo hace server.js (así los tests usan la app con supertest).
 */
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { parse as parseYaml } from "yaml";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import api from "./routes/index.js";
import { apiNotFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = process.env.FRONTEND_DIR || path.resolve(here, "../../frontend");
const openapi = parseYaml(readFileSync(path.resolve(here, "../openapi.yaml"), "utf8"));

export const app = express();
app.set("trust proxy", 1); // detrás del proxy de Render, para que el rate limit vea la IP real
app.disable("x-powered-by");

// CSP estricta para la PWA; Swagger UI necesita scripts/estilos en línea, así que se le exime.
const helmetApp = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      mediaSrc: ["'self'"],
      connectSrc: ["'self'"],
      workerSrc: ["'self'"],
      upgradeInsecureRequests: null
    }
  }
});
const helmetDocs = helmet({ contentSecurityPolicy: false });
app.use((req, res, next) => (req.path.startsWith("/api/docs") ? helmetDocs : helmetApp)(req, res, next));

if (env.allowedOrigins.length) app.use("/api", cors({ origin: env.allowedOrigins }));
if (!env.isTest) app.use(morgan(env.isProd ? "combined" : "dev"));
app.use(express.json({ limit: "100kb" }));

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false,
  skip: () => env.isTest,
  handler: (req, res) => res.status(429).json({ error: { code: "DEMASIADAS_PETICIONES", message: "Demasiadas peticiones, intenta más tarde" } })
}));

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: "Rodando UTP · API" }));
app.get("/api/openapi.json", (req, res) => res.json(openapi));
app.use("/api", api);
app.use("/api", apiNotFound);

// Frontend. sw.js y el manifest no se cachean en el navegador para que las actualizaciones lleguen.
app.use(express.static(frontendDir, {
  setHeaders: (res, file) => {
    if (/(sw\.js|manifest\.json|index\.html)$/.test(file)) res.setHeader("Cache-Control", "no-cache");
  }
}));

app.use(errorHandler);
