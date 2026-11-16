-- Solo los avisos que se repiten por posición/estado se deduplican por día.
-- Las solicitudes y los avisos de pasajeros deben registrarse y notificarse una vez por evento.
ALTER TABLE notificaciones_log
  DROP CONSTRAINT IF EXISTS notificaciones_log_user_id_raite_id_fecha_tipo_key;

CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_dedupe_idx
  ON notificaciones_log(user_id, raite_id, fecha, tipo)
  WHERE tipo IN ('inicio', 'fin', 'proximidad');
