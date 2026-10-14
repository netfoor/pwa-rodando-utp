# Endpoints

Prefijo `/api`, JSON. Documentación interactiva: `/api/docs` (OpenAPI en `backend/openapi.yaml`).
Autenticación: cabecera `Authorization: Bearer <token>`. Días: 0 = lunes … 5 = sábado.
Error: `{ "error": { "code", "message", "details" } }`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/health` | público | `{status, db, version, uptime}` |
| POST | `/auth/registro` | público | Crea cuenta (pasajero o conductor); devuelve `{token, usuario}` |
| POST | `/auth/login` | público | Inicia sesión |
| GET | `/auth/me` | sesión | Perfil propio |
| GET | `/zonas` · `/zonas/:id` | público | Zonas con coordenadas y trazo del mapa |
| GET | `/raites` | público | Filtros: `zona`, `turno` (manana/tarde/noche; matutino/vespertino), `tipo`, `libres=true`, `dia` |
| GET | `/raites/mios` | sesión | Raites del conductor (incluye pausados) |
| GET | `/raites/:id` | público | Detalle |
| POST | `/raites` | conductor/admin | Publica un raite |
| PATCH | `/raites/:id` | dueño/admin | Edita (también `activo`) |
| DELETE | `/raites/:id` | dueño/admin | Elimina |
| POST | `/reservas` | sesión | `{raiteId, dia, parada, nombre}` → código `RU-XXXX` (409 `RAITE_LLENO`, `RESERVA_DUPLICADA`) |
| GET | `/reservas/mias` | sesión | Mis lugares apartados |
| DELETE | `/reservas/:codigo` | dueño/admin | Cancela |
| POST | `/conductores/solicitud` | público | Formulario «Registro de conductor» |
| GET | `/admin/solicitudes` | admin | Lista solicitudes (`?estado=`) |
| POST | `/admin/solicitudes/:id/aprobar` | admin | Aprueba; si hay cuenta con ese correo, la hace conductor y publica su raite |
| GET | `/admin/resumen` | admin | Conteos por tabla (tarjetas del panel) |
| GET/POST | `/admin/{zonas\|testimonios\|faq}` | admin | Lista / crea registros del catálogo |
| PATCH/DELETE | `/admin/{zonas\|testimonios\|faq}/:id` | admin | Edita / elimina (409 `EN_USO` si una zona tiene raites) |
| GET | `/admin/usuarios` | admin | Lista usuarios |
| PATCH/DELETE | `/admin/usuarios/:id` | admin | Cambia rol / elimina (no a uno mismo) |
| GET | `/admin/reservas` · `/admin/raites` | admin | Vistas globales (reservas más recientes, todos los raites) |
| GET | `/cache/stats` | público | Contadores de la caché (entradas, hits, misses, aciertos) |
| DELETE | `/cache` | admin | Vacía la caché |
| GET | `/stats` | público | `{estudiantes, conductores, co2Toneladas}` |
| GET | `/testimonios` · `/faq` · `/config` | público | Catálogos |
| POST | `/calculadora` | público | `{rol, km, dias, pasajeros, rendimiento, precio}` → ahorros, CO₂, litros, barras |
| GET | `/push/vapid-public-key` | público | Llave VAPID (503 si no está configurada) |
| POST | `/push/subscribe` | opcional | Guarda la suscripción push |
| POST | `/push/send` | admin | `{titulo, mensaje, userId?}` |

## Ejemplos

```bash
curl -s localhost:3000/api/raites?zona=centro&turno=manana&libres=true

TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"correo":"mariana.lopez@utpuebla.edu.mx","password":"Demo1234!"}' | jq -r .token)

curl -s -X POST localhost:3000/api/raites -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"zona":"cholula","tipo":"ida","hora":"07:15","dias":[0,1,2],"asientos":3,"aportacion":40,"paradas":["Zócalo de Cholula"]}'
```
