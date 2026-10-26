-- Seguimiento en vivo (Subproducto 5): coordenadas y trazo de cada zona,
-- última posición por viaje/día y solicitudes de lugar desde la vista en vivo.

ALTER TABLE zonas ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE zonas ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE zonas ADD COLUMN IF NOT EXISTS trazo JSONB;

ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_estado_check;
ALTER TABLE reservas ADD CONSTRAINT reservas_estado_check
  CHECK (estado IN ('confirmada','cancelada','pendiente','rechazada'));

DROP INDEX IF EXISTS reservas_unica_idx;
CREATE UNIQUE INDEX reservas_unica_idx
  ON reservas(raite_id, user_id, dia) WHERE estado IN ('confirmada','pendiente');
CREATE INDEX IF NOT EXISTS reservas_pendientes_idx
  ON reservas(raite_id, dia) WHERE estado = 'pendiente';

CREATE TABLE IF NOT EXISTS viajes (
  id            SERIAL PRIMARY KEY,
  raite_id      INTEGER NOT NULL REFERENCES raites(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'en_camino'
                CHECK (estado IN ('programado','en_camino','recogiendo','en_ruta','finalizado')),
  lat           DOUBLE PRECISION CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  lng           DOUBLE PRECISION CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  precision_m   REAL,
  velocidad_ms  REAL,
  rumbo         REAL,
  actualizado_en TIMESTAMPTZ,
  iniciado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_en TIMESTAMPTZ,
  UNIQUE (raite_id, fecha)
);
CREATE INDEX IF NOT EXISTS viajes_activos_idx ON viajes(fecha, estado) WHERE estado <> 'finalizado';
