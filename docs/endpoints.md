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
| GET | `/vivo/:id` | opcional | Estado del viaje de hoy: ruta, paradas, ETA y posición; `participantes` y `solicitudesPendientes` solo para participantes |
| POST | `/vivo/:id/iniciar` | conductor | Abre el viaje del día y empieza a compartir |
| POST | `/vivo/:id/posicion` | conductor | `{lat, lng, precision, velocidad, rumbo}`; rechaza precisión > 30 m |
| PATCH | `/vivo/:id/estado` | conductor | `en_camino`, `recogiendo`, `en_ruta` o `finalizado` |
| POST | `/vivo/:id/finalizar` | conductor | Cierra el viaje y borra la posición |
| POST | `/vivo/:id/solicitar` | sesión | Solicitud de lugar (queda `pendiente`; 409 `RAITE_LLENO` al aceptar sin cupo) |
| GET | `/vivo/:id/solicitudes` | conductor | Solicitudes pendientes con distancia y ETA |
| GET | `/vivo/:id/notificaciones` | conductor/admin | Bitácora de avisos push del viaje (tipo, parada, resultado, fecha) |
| POST | `/vivo/:id/solicitudes/:codigo/{aceptar\|rechazar}` | conductor | Responde la solicitud |
| POST | `/vivo/:id/avisar` | sesión | Avisa al conductor que el pasajero ya espera |
| POST | `/vivo/ws-ticket` | sesión | Ticket efímero de 60 s para abrir el WebSocket |
| WS | `/vivo/ws?token=TICKET` | sesión | Canal en vivo; ver protocolo abajo |
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
| POST | `/push/prueba` | sesión | Envía un aviso de prueba a las suscripciones del usuario |
| POST | `/push/send` | admin | `{titulo, mensaje, userId?}` |

## WebSocket de seguimiento en vivo

1. `POST /vivo/ws-ticket` con `Authorization: Bearer <JWT>` devuelve `{ticket, expiraEn: 60}`.
2. Abrir `wss://<host>/api/vivo/ws?token=<ticket>`. El JWT de sesión sigue funcionando como respaldo.
3. Enviar `{"tipo":"suscribir","raiteId":1,"fecha":"2026-11-16"}` para entrar a la sala del viaje.
4. El servidor responde `suscrito` con el estado y la posición; después difunde los cambios.

Mensajes del cliente:

- `{"tipo":"ping"}` → responde `pong`.
- `{"tipo":"suscribir","raiteId":1,"fecha":"AAAA-MM-DD"}`.
- `{"tipo":"posicion","raiteId":1,"lat":19.04,"lng":-98.19,"precision":8,"velocidad":10,"rumbo":90,"fecha":"AAAA-MM-DD"}` (solo conductor).

Mensajes del servidor: `suscrito`, `posicion`, `estado`, `solicitudes`, `reserva`, `finalizado` y `error` (`{tipo, code, message}`).

Reglas: solo el conductor, el admin y los participantes reciben la posición; al cancelar o rechazar la reserva el canal responde `PROHIBIDO`. En producción el `Origin` debe ser el mismo host o estar en `ALLOWED_ORIGINS`. Límites: payload de 4 KB y 30 mensajes por conexión cada 10 segundos.

Los avisos push del viaje se registran en `notificaciones_log` y se consultan con `GET /vivo/:id/notificaciones` (conductor o admin). Tipos: `solicitud`, `aceptacion`, `rechazo`, `aviso`, `inicio`, `fin` y `proximidad`; esta última se envía una sola vez por pasajero cuando su parada está a 3 minutos o menos.

## Ejemplos

```bash
curl -s localhost:3000/api/raites?zona=centro&turno=manana&libres=true

TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"correo":"mariana.lopez@utpuebla.edu.mx","password":"Demo1234!"}' | jq -r .token)

curl -s -X POST localhost:3000/api/raites -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"zona":"cholula","tipo":"ida","hora":"07:15","dias":[0,1,2],"asientos":3,"aportacion":40,"paradas":["Zócalo de Cholula"]}'
```

El WebSocket valida que el usuario sea conductor o participante del viaje; al cancelar o rechazar la reserva, el servidor lo saca de la sala. Las rutas de `/vivo` aceptan `fecha=AAAA-MM-DD` (por defecto hoy en Puebla).
