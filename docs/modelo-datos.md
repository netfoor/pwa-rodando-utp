# Modelo de datos (PostgreSQL)

```mermaid
erDiagram
  users ||--o| drivers : "perfil de conductor"
  users ||--o{ reservas : "aparta"
  users ||--o{ push_subscriptions : "tiene"
  drivers ||--o{ raites : "publica"
  zonas ||--o{ raites : "sale de"
  zonas ||--o{ solicitudes_conductor : "propone"
  raites ||--o{ reservas : "recibe"
  raites ||--o{ viajes : "sigue"

  users {
    int id PK
    text nombre
    text correo UK "@utpuebla.edu.mx"
    text password_hash
    text rol "pasajero|conductor|admin"
    text carrera
    smallint cuatrimestre
    bool es_demo
    timestamptz created_at
  }
  drivers {
    int user_id PK,FK
    text auto
    text placas
    numeric rating
    int viajes
    bool verificado
  }
  zonas {
    text id PK
    text nombre
    int km
    int x
    int y
    text color
    text trazo_svg
    smallint orden
    double lat
    double lng
    jsonb trazo "ruta vial [lat,lng][]"
  }
  raites {
    int id PK
    text zona_id FK
    int driver_id FK
    text tipo "ida|regreso"
    char5 hora
    smallint_arr dias "0=lun..5=sab"
    smallint asientos
    int aportacion
    text_arr paradas
    bool activo
  }
  reservas {
    int id PK
    text codigo UK "RU-XXXX"
    int raite_id FK
    int user_id FK
    smallint dia "0-5"
    text parada
    text nombre
    text estado "confirmada|pendiente|rechazada|cancelada"
    timestamptz created_at
  }
  testimonios { int id PK  text texto  text nombre  text rol  smallint orden }
  faq { int id PK  text pregunta  text respuesta  smallint orden }
  config { text clave PK  numeric valor }
  push_subscriptions { int id PK  int user_id FK  text endpoint UK  text p256dh  text auth }
  solicitudes_conductor { int id PK  text nombre  text correo  text auto  text zona_id FK  char5 hora  smallint lugares  text estado }
  viajes {
    int id PK
    int raite_id FK
    date fecha
    text estado "programado|en_camino|recogiendo|en_ruta|finalizado"
    double lat
    double lng
    real precision_m
    real velocidad_ms
    real rumbo
    timestamptz actualizado_en
    timestamptz iniciado_en
    timestamptz finalizado_en
  }
```

## Reglas de integridad

- `users.correo` es único y debe cumplir `^[^@\s]+@utpuebla\.edu\.mx$` (CHECK en la base).
- Índice único parcial `reservas(raite_id, user_id, dia) WHERE estado IN ('confirmada','pendiente')`: una persona no puede apartar ni solicitar dos veces el mismo raite el mismo día, pero sí volver a intentarlo tras cancelar o ser rechazada.
- `viajes` tiene una fila por raite y fecha (`UNIQUE (raite_id, fecha)`); guarda la última posición y su estado. Al finalizar se borran las coordenadas y se marca `finalizado`.
- Borrar un raite elimina en cascada sus reservas; borrar un usuario elimina su perfil de conductor y sus suscripciones.
- `config` guarda los parámetros de la calculadora (`precioGasolina` 24.3, `co2PorLitro` 2.31, `tarifaUberKm` 9.5, `tarifaUberBase` 35, `pasajeTransporte` 12) y las cifras base del hero (`stats_*`, que la API no expone en `/api/config`).
- `users.es_demo` marca a los usuarios del seed para que no cuenten en `/api/stats`.

Las migraciones están en `backend/src/db/migrations/` y el registro de las aplicadas en la tabla `schema_migrations`.
