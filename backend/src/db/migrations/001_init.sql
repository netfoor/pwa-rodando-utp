-- Esquema inicial de Rodando UTP.
-- Todas las sentencias son idempotentes (IF NOT EXISTS) para poder reejecutarse.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  correo        TEXT NOT NULL UNIQUE CHECK (correo ~* '^[^@\s]+@utpuebla\.edu\.mx$'),
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'pasajero' CHECK (rol IN ('pasajero','conductor','admin')),
  carrera       TEXT,
  cuatrimestre  SMALLINT,
  es_demo       BOOLEAN NOT NULL DEFAULT false, -- usuarios sembrados (no cuentan en /api/stats)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drivers (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  auto       TEXT NOT NULL,
  placas     TEXT,
  rating     NUMERIC(2,1) NOT NULL DEFAULT 5.0,
  viajes     INTEGER NOT NULL DEFAULT 0,
  verificado BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS zonas (
  id        TEXT PRIMARY KEY,
  nombre    TEXT NOT NULL,
  km        INTEGER NOT NULL,
  x         INTEGER NOT NULL,
  y         INTEGER NOT NULL,
  color     TEXT NOT NULL,
  trazo_svg TEXT NOT NULL,
  orden     SMALLINT NOT NULL DEFAULT 0 -- orden de aparición en selects y leyenda
);

CREATE TABLE IF NOT EXISTS raites (
  id         SERIAL PRIMARY KEY,
  zona_id    TEXT NOT NULL REFERENCES zonas(id),
  driver_id  INTEGER NOT NULL REFERENCES drivers(user_id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('ida','regreso')),
  hora       CHAR(5) NOT NULL CHECK (hora ~ '^[0-2][0-9]:[0-5][0-9]$'),
  dias       SMALLINT[] NOT NULL,
  asientos   SMALLINT NOT NULL CHECK (asientos BETWEEN 1 AND 8),
  aportacion INTEGER NOT NULL CHECK (aportacion >= 0),
  paradas    TEXT[] NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS raites_zona_idx ON raites(zona_id);

CREATE TABLE IF NOT EXISTS reservas (
  id         SERIAL PRIMARY KEY,
  codigo     TEXT NOT NULL UNIQUE,
  raite_id   INTEGER NOT NULL REFERENCES raites(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  dia        SMALLINT NOT NULL CHECK (dia BETWEEN 0 AND 5),
  parada     TEXT NOT NULL,
  nombre     TEXT NOT NULL,
  estado     TEXT NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada','cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un usuario no puede apartar dos veces el mismo raite el mismo día (si sigue confirmada).
CREATE UNIQUE INDEX IF NOT EXISTS reservas_unica_idx
  ON reservas(raite_id, user_id, dia) WHERE estado = 'confirmada';
CREATE INDEX IF NOT EXISTS reservas_raite_dia_idx ON reservas(raite_id, dia) WHERE estado = 'confirmada';

CREATE TABLE IF NOT EXISTS testimonios (
  id     SERIAL PRIMARY KEY,
  texto  TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol    TEXT NOT NULL,
  orden  SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS faq (
  id        SERIAL PRIMARY KEY,
  pregunta  TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  orden     SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id       SERIAL PRIMARY KEY,
  user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh   TEXT NOT NULL,
  auth     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS solicitudes_conductor (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL,
  correo     TEXT NOT NULL,
  carrera    TEXT,
  auto       TEXT NOT NULL,
  zona_id    TEXT NOT NULL REFERENCES zonas(id),
  hora       CHAR(5) NOT NULL,
  lugares    SMALLINT NOT NULL DEFAULT 3,
  estado     TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
