-- Bitácora de avisos push ligados a un viaje en vivo. El índice único evita
-- repetir el mismo aviso (por ejemplo, proximidad) para el mismo usuario/día.
CREATE TABLE IF NOT EXISTS notificaciones_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raite_id   INTEGER NOT NULL REFERENCES raites(id) ON DELETE CASCADE,
  fecha      DATE NOT NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('solicitud','aceptacion','rechazo','aviso','inicio','fin','proximidad')),
  parada     TEXT,
  enviado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  resultado  TEXT NOT NULL DEFAULT 'pendiente' CHECK (resultado IN ('pendiente','enviado','sin_suscripcion','omitido')),
  detalle    TEXT,
  UNIQUE (user_id, raite_id, fecha, tipo)
);
CREATE INDEX IF NOT EXISTS notificaciones_viaje_idx
  ON notificaciones_log(raite_id, fecha, enviado_en DESC);
