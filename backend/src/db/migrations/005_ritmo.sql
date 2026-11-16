-- Ritmo: grupos de raite recurrentes. Un grupo une a un pasajero con un raite en
-- ciertos días de la semana; al confirmarlo se generan sus reservas. Las ausencias
-- registran los días puntuales en que el integrante no viajará.
CREATE TABLE IF NOT EXISTS ritmo_grupos (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raite_id    INTEGER NOT NULL REFERENCES raites(id) ON DELETE CASCADE,
  dias        SMALLINT[] NOT NULL CHECK (cardinality(dias) BETWEEN 1 AND 6),
  parada      TEXT NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','cancelado')),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ritmo_grupo_activo_idx
  ON ritmo_grupos(user_id, raite_id) WHERE estado = 'activo';

CREATE TABLE IF NOT EXISTS ritmo_ausencias (
  id        SERIAL PRIMARY KEY,
  grupo_id  INTEGER NOT NULL REFERENCES ritmo_grupos(id) ON DELETE CASCADE,
  fecha     DATE NOT NULL,
  motivo    TEXT,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, fecha)
);
