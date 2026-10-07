# ---- Etapa 1: dependencias de producción ----
FROM node:20-alpine AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ---- Etapa 2: imagen final (API + frontend estático) ----
FROM node:20-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY frontend ./frontend
# Usuario sin privilegios de root
RUN chown -R node:node /app
USER node
WORKDIR /app/backend
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
# server.js ejecuta migraciones y seed (idempotentes) antes de abrir el puerto.
CMD ["node", "src/server.js"]
