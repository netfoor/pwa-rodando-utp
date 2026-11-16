"""
Genera el reporte del Subproducto No. 7 «Aportación - Backend» en DOCX y en HTML
listo para imprimir a PDF.

Uso:  uv run --with python-docx python generar_backend.py
Salida:
  Backend_Rodando_UTP_Live.docx
  _build/backend.html   (después: node imprimir_pdf.mjs _build/backend.html Backend_Rodando_UTP_Live.pdf)

Las ubicaciones en el código (ruta:línea) se calculan al generar, buscando un texto
ancla en cada archivo; si un ancla ya no existe, el script se detiene.
"""
import html
from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt

BASE = Path(__file__).resolve().parent
RAIZ = BASE.parent.parent
IMG = BASE / "img"
BUILD = BASE / "_build"
BUILD.mkdir(exist_ok=True)

DOCX = BASE / "Backend_Rodando_UTP_Live.docx"
HTML = BUILD / "backend.html"

URL_APP = "https://rodando-utp-m12i.onrender.com"
REPO = "https://github.com/netfoor/pwa-rodando-utp"


def L(ruta, ancla):
    """Devuelve «ruta:línea» de la primera línea que contiene el ancla."""
    for n, linea in enumerate((RAIZ / ruta).read_text(encoding="utf-8").splitlines(), start=1):
        if ancla in linea:
            return f"{ruta}:{n}"
    raise SystemExit(f"Ancla no encontrada en {ruta}: {ancla!r}")


BREAKS = {
    "1. Introducción",
    "4. Implementación del backend",
    "5. Lista de cotejo",
    "6. Evidencias",
    "9. Conclusiones",
    "10. Referencias",
    "Apéndice A. Correspondencia con lo solicitado",
}

PORTADA = {
    "institucion": "Universidad Tecnológica de Puebla",
    "division": "División de Tecnologías de la Información",
    "materia": "10 A – Aplicaciones Web Progresivas",
    "docente": "Mtra. Xóchitl Mendoza Píscil",
    "periodo": "Periodo Septiembre–Diciembre 2026",
    "fecha": "15 de noviembre de 2026",
    "alumno": "Fortino Romero Mantilla",
    "carrera": "Desarrollo de Software Multiplataforma",
    "tipo": "Subproducto No. 7: Aportación - Backend",
    "titulo": "Backend de Rodando UTP Live",
    "subtitulo": "Servidor del seguimiento en vivo y lista de cotejo de la aplicación web progresiva",
}

INDICE = [
    ("1. Introducción", 0),
    ("2. La propuesta del Subproducto 5", 0),
    ("3. Arquitectura y tecnologías", 0),
    ("4. Implementación del backend", 0),
    ("4.1 Modelo de datos", 1),
    ("4.2 API REST del seguimiento en vivo", 1),
    ("4.3 Canal en tiempo real", 1),
    ("4.4 Autenticación y autorización", 1),
    ("4.5 Validación y manejo de errores", 1),
    ("4.6 Notificaciones push ligadas al viaje", 1),
    ("4.7 Caché y funcionamiento sin conexión", 1),
    ("4.8 Privacidad de la ubicación", 1),
    ("5. Lista de cotejo", 0),
    ("6. Evidencias", 0),
    ("7. Pruebas", 0),
    ("8. Alcance y limitaciones", 0),
    ("9. Conclusiones", 0),
    ("10. Referencias", 0),
    ("Apéndice A. Correspondencia con lo solicitado", 0),
    ("Apéndice B. Enlaces de la entrega", 0),
]

# ── Lista de cotejo: criterio, qué se comprueba, cómo se cumple, código, evidencia ──
COTEJO = [
    ["1", "Instalación de la aplicación",
     "Que se pueda instalar en los dispositivos compatibles.",
     "Botón «Instalar app» que usa beforeinstallprompt en Chrome, Edge y Android; en iPhone muestra los pasos "
     "de Safari (Compartir → Agregar a inicio).",
     "\n".join([L("frontend/js/app.js", 'addEventListener("beforeinstallprompt"'),
                L("frontend/js/app.js", "function instruccionesInstalar"),
                L("frontend/index.html", 'id="installBtn"')]),
     "Figura 3"],
    ["2", "Icono de la aplicación",
     "Iconos adecuados para la instalación y la pantalla de inicio.",
     "Iconos de 192 y 512 px, uno maskable con margen seguro para Android y apple-touch-icon de 180 px para iOS.",
     "\n".join([L("frontend/manifest.json", '"icons"'), L("frontend/index.html", "apple-touch-icon")]),
     "Figura 4"],
    ["3", "Protocolo HTTPS",
     "Que funcione mediante HTTPS (salvo localhost en desarrollo).",
     "Render publica solo por HTTPS; el servidor agrega HSTS, CSP y demás cabeceras con helmet.",
     "\n".join([L("backend/src/app.js", 'import helmet from "helmet"'), L("render.yaml", "type: web")]),
     "Figura 5"],
    ["4", "Archivo Manifest",
     "manifest.json válido con nombre, iconos, colores y modo de visualización.",
     "Nombre, short_name, id, start_url, scope, display standalone, colores, iconos, accesos directos y capturas.",
     "\n".join([L("frontend/manifest.json", '"display"'), L("frontend/index.html", 'rel="manifest"')]),
     "Figura 4"],
    ["5", "Service Worker",
     "Que esté registrado y gestione recursos y solicitudes.",
     "sw.js precachea la aplicación en install, limpia versiones en activate y atiende fetch con red primero "
     "y respaldo en caché; nunca guarda rutas privadas.",
     "\n".join([L("frontend/sw.js", 'self.addEventListener("install"'),
                L("frontend/sw.js", 'self.addEventListener("fetch"'),
                L("frontend/js/app.js", 'navigator.serviceWorker.register("sw.js")')]),
     "Figura 6"],
    ["6", "Diseño responsivo",
     "Que la interfaz se adapte a diferentes tamaños de pantalla.",
     "Viewport, rejillas fluidas y puntos de quiebre en 1180, 900, 760 y 600 px; se verificó que no haya "
     "desplazamiento horizontal a 360 y 390 px.",
     "\n".join([L("frontend/index.html", 'name="viewport"'), L("frontend/css/styles.css", "@media (max-width: 600px)"),
                L("frontend/css/vivo.css", "@media (max-width: 760px)")]),
     "Figuras 1 y 2"],
    ["7", "Memoria caché",
     "Recursos necesarios en caché para el acceso sin conexión.",
     "38 recursos de la aplicación en la caché rodando-utp-v7; en el servidor, caché en memoria con TTL, "
     "ETag y 304 para las lecturas públicas.",
     "\n".join([L("frontend/sw.js", "const ARCHIVOS = ["), L("backend/src/middlewares/cache.js", "export const cache =")]),
     "Figura 6"],
    ["8", "Cache API",
     "Uso correcto de la API de caché para almacenar y recuperar recursos.",
     "caches.open, keys, has, delete; cache.add, addAll, put, match, matchAll y delete en el laboratorio; la "
     "última posición del auto se guarda con cache.put en rodando-live-v1.",
     "\n".join([L("frontend/js/cache.js", "caches.open("), L("frontend/js/vivo.js", "caches.open(CACHE)")]),
     "Figura 7"],
    ["9", "Compatibilidad con sistemas operativos",
     "Que funcione en Windows, macOS, Android e iOS según sus funciones.",
     "Una sola base de código web; detección de iOS para la instalación; push en iOS 16.4+ con la PWA "
     "instalada (WebKit, 2023).",
     L("frontend/js/app.js", "const esIOS"),
     "Figuras 2 y 3"],
    ["10", "Compatibilidad multiplataforma",
     "Escritorio, smartphones y navegadores web.",
     "La misma PWA y la misma API sirven a escritorio y móvil; vistas verificadas a 1440, 390 y 360 px.",
     "\n".join([L("frontend/css/styles.css", "@media (max-width: 1180px)"), L("backend/src/app.js", "express.static")]),
     "Figuras 1 y 2"],
    ["11", "Actualización de datos",
     "Que los cambios en la base de datos se reflejen en la aplicación.",
     "Cada posición, solicitud o cambio de estado se guarda en PostgreSQL y se difunde por WebSocket a la sala "
     "del viaje; si el canal falla, la vista consulta cada 20 s. Las escrituras vacían la caché del servidor.",
     "\n".join([L("backend/src/realtime.js", "export async function difundirPosicion"),
                L("backend/src/controllers/vivo.controller.js", "await difundirPosicion"),
                L("frontend/js/vivo.js", "new WebSocket("),
                L("backend/src/middlewares/cache.js", "limpiar(); });")]),
     "Figuras 10 y 12"],
    ["12", "Funcionamiento sin conexión",
     "Que las funciones disponibles sin internet sigan funcionando.",
     "Sin red se sirven la aplicación y la última copia de las lecturas públicas; la barra avisa el estado.",
     "\n".join([L("frontend/sw.js", 'caches.match("./index.html")'), L("frontend/js/api.js", "ls.get(CACHE + path)"),
                L("frontend/js/app.js", "function updateOnline")]),
     "Figura 8"],
    ["13", "Persistencia del inicio de sesión y progreso",
     "Que se conserven la sesión y los datos previos sin internet.",
     "La sesión (JWT) se guarda en el dispositivo y el servidor revalida al usuario en cada petición; la "
     "última posición del viaje queda en Cache Storage y se borra al cerrar sesión.",
     "\n".join([L("frontend/js/api.js", 'TOKEN_KEY = "ru-token"'), L("backend/src/middlewares/auth.js", "async function usuarioActual"),
                L("frontend/js/api.js", "function logout")]),
     "Figura 8"],
    ["14", "Notificaciones push",
     "Recibir y mostrar notificaciones push en plataformas compatibles.",
     "El servidor envía avisos de solicitud, aceptación, inicio, proximidad (3 min), aviso del pasajero y fin; "
     "el service worker los muestra; cada envío queda en una bitácora.",
     "\n".join([L("backend/src/services/push.service.js", "export async function notificarViaje"),
                L("backend/src/services/vivo.service.js", "async function avisarProximidad"),
                L("frontend/sw.js", 'addEventListener("push"')]),
     "Figura 9"],
    ["15", "Base de datos",
     "Que los datos se almacenen, consulten y actualicen correctamente.",
     "PostgreSQL con migraciones versionadas; tablas viajes, reservas, push_subscriptions y "
     "notificaciones_log con restricciones CHECK, UNIQUE e índices parciales.",
     "\n".join([L("backend/src/db/migrations/002_vivo.sql", "CREATE TABLE IF NOT EXISTS viajes"),
                L("backend/src/db/migrations/003_notificaciones.sql", "CREATE TABLE IF NOT EXISTS notificaciones_log"),
                L("backend/src/db/migrate.js", "export async function migrate")]),
     "Figuras 9 y 11"],
    ["16", "Tecnologías utilizadas",
     "Identificar y documentar lenguajes, frameworks y herramientas.",
     "Sección 3 de este reporte, README del repositorio y documentación OpenAPI en /api/docs.",
     "\n".join([L("backend/package.json", '"dependencies"'), L("Dockerfile", "FROM node:20-alpine"),
                L("backend/openapi.yaml", "/api/vivo/ws:")]),
     "Tabla 1, Figura 10"],
    ["17", "Backend",
     "Que el servidor procese solicitudes, autenticación y operaciones.",
     "API REST en Express con validación zod, JWT, roles, transacciones y errores uniformes; WebSocket con "
     "ticket de 60 s, origen permitido y límite de mensajes; 50 pruebas automatizadas.",
     "\n".join([L("backend/src/routes/index.js", "// Seguimiento en vivo"),
                L("backend/src/middlewares/auth.js", "export async function requireAuth"),
                L("backend/src/middlewares/errorHandler.js", "23505"),
                L("backend/src/realtime.js", "wsMensajeSchema.safeParse")]),
     "Figuras 10 y 12"],
]

CONTENIDO = [
    ("h1", "1. Introducción"),
    ("p", "Rodando UTP es una aplicación web progresiva (PWA) para compartir raites entre estudiantes de la "
          "Universidad Tecnológica de Puebla. En el Subproducto 5 se propuso Rodando UTP Live: que el pasajero vea "
          "en un mapa el auto que lo recogerá, con la hora estimada de llegada a su parada, y que pueda pedir su "
          "lugar mientras el conductor va en camino. Este reporte documenta el backend que hace posible esa "
          "propuesta y que hoy funciona en la aplicación publicada."),
    ("p", "La actividad pide desarrollar de manera individual el backend de la PWA sobre la propuesta del "
          "Subproducto 5 y documentarlo con una lista de cotejo de al menos doce características. El reporte usa la "
          "lista de cotejo de diecisiete criterios proporcionada en clase y, para cada uno, indica cómo se cumple, "
          "en qué archivo y línea del código está implementado y con qué evidencia se comprueba."),
    ("p", "El documento se organiza así: primero se resume la propuesta y la arquitectura; después se explica la "
          "implementación del servidor por componentes; luego se presenta la lista de cotejo y las evidencias "
          "tomadas de la aplicación publicada; por último se describen las pruebas automatizadas y los límites "
          "reales del prototipo."),

    ("h1", "2. La propuesta del Subproducto 5"),
    ("p", "La propuesta partió de un hueco de información: entre la reserva y la salida, el pasajero no sabe si el "
          "auto ya salió, por dónde va ni cuánto falta. Esa duda se resolvía por mensajes fuera de la aplicación. "
          "Rodando UTP Live agrega una sección «En vivo» con dos vistas que comparten el mismo estado del viaje: la "
          "del pasajero, que observa y solicita, y la del conductor, que comparte su ubicación y responde."),
    ("p", "El backend resuelve cinco necesidades de esa propuesta: guardar el estado de cada viaje del día y la "
          "última posición del auto; calcular la distancia y el tiempo estimado a cada parada; distribuir los "
          "cambios al instante solo a quienes participan en el viaje; manejar las solicitudes de lugar sin "
          "sobreventa de asientos; y avisar con notificaciones push en los momentos importantes, incluso con la "
          "aplicación cerrada."),

    ("h1", "3. Arquitectura y tecnologías"),
    ("p", "La aplicación se publica como un solo contenedor Docker en Render. El mismo servidor Express atiende "
          "la API REST en /api, el canal WebSocket en /api/vivo/ws, la documentación OpenAPI en /api/docs y los "
          "archivos estáticos de la PWA. PostgreSQL guarda los datos y las migraciones se aplican solas al "
          "iniciar. El navegador conserva la aplicación en Cache Storage mediante el service worker y recibe las "
          "notificaciones a través del servicio push del navegador."),
    ("ul", [
        "Cliente: HTML, CSS y JavaScript sin framework; service worker, Cache Storage API, Geolocation API, "
        "WebSocket API, Push API y Notifications API.",
        "Servidor: Node.js 20 con Express 4 en módulos ES; ws para el canal en tiempo real; web-push para las "
        "notificaciones firmadas con VAPID.",
        "Datos: PostgreSQL (versión 16 en desarrollo y pruebas) con el controlador pg y migraciones SQL versionadas.",
        "Seguridad: JWT, bcrypt, helmet (HSTS y CSP), CORS, límite de peticiones y validación con zod.",
        "Calidad y despliegue: Vitest y Supertest sobre una base real, ESLint, Docker y Render con "
        "despliegue automático desde la rama principal.",
    ]),
    ("tabla", {
        "num": "Tabla 1",
        "titulo": "Tecnologías del backend y su función en Rodando UTP Live",
        "headers": ["Capa", "Tecnología", "Versión", "Función"],
        "widths": [1.1, 1.6, 0.9, 3.0],
        "size": 9.5,
        "rows": [
            ["Lenguaje", "JavaScript (Node.js)", "20", "Ejecuta el servidor; misma lengua que el cliente"],
            ["Framework", "Express", "4.22", "Rutas, middlewares y archivos estáticos"],
            ["Tiempo real", "ws", "8.22", "WebSocket en el mismo puerto HTTP, salas por viaje"],
            ["Base de datos", "PostgreSQL / pg", "16 / 8.23", "Persistencia, transacciones y restricciones (16 es la versión local)"],
            ["Validación", "zod", "4.6", "Esquemas de cuerpos, parámetros y mensajes WebSocket"],
            ["Autenticación", "jsonwebtoken / bcryptjs", "9.0 / 3.0", "Tokens de sesión y contraseñas con hash"],
            ["Notificaciones", "web-push", "3.6", "Envío cifrado con llaves VAPID"],
            ["Seguridad", "helmet / express-rate-limit", "8.3 / 8.7", "Cabeceras HTTPS y límite de intentos"],
            ["Documentación", "OpenAPI 3 / swagger-ui-express", "5.0", "Contrato de la API en /api/docs"],
            ["Pruebas", "Vitest / Supertest", "5.0 / 7.3", "50 pruebas contra PostgreSQL real"],
            ["Despliegue", "Docker / Render", "—", "Contenedor único con HTTPS y health check"],
        ],
    }),

    ("h1", "4. Implementación del backend"),
    ("p", "Esta sección recorre el servidor por componentes. Las rutas de archivo que aparecen entre paréntesis "
          "corresponden al repositorio del proyecto y se repiten, con su número de línea, en la lista de cotejo."),

    ("h2", "4.1 Modelo de datos"),
    ("p", "El seguimiento en vivo se apoya en cuatro tablas. viajes guarda un registro por raite y por fecha, con "
          "su estado (programado, en camino, recogiendo, en ruta o finalizado), la última posición, la precisión "
          "del GPS, la velocidad y el rumbo; la restricción UNIQUE (raite_id, fecha) impide abrir dos viajes del "
          "mismo raite el mismo día. reservas se amplió con los estados pendiente y rechazada, y un índice único "
          "parcial evita que una persona tenga dos solicitudes activas en el mismo viaje. push_subscriptions "
          "conserva el endpoint y las llaves de cada navegador suscrito. notificaciones_log registra cada aviso "
          "enviado, con su resultado."),
    ("p", "Las migraciones viven en backend/src/db/migrations y se aplican en orden con un candado de PostgreSQL "
          "(pg_advisory_lock), de modo que dos instancias no migren al mismo tiempo. Para esta entrega se "
          "agregaron 003_notificaciones.sql, con la bitácora de avisos, y 004_notificaciones_dedupe.sql, que "
          "limita a uno por día los avisos de inicio, fin y proximidad sin bloquear las solicitudes de distintos "
          "pasajeros."),

    ("h2", "4.2 API REST del seguimiento en vivo"),
    ("p", "La Tabla 2 resume las rutas del seguimiento en vivo. Todas validan sus parámetros con zod y declaran su "
          "nivel de acceso; las operaciones del conductor comprueban además que el raite le pertenezca."),
    ("tabla", {
        "num": "Tabla 2",
        "titulo": "Rutas del seguimiento en vivo",
        "headers": ["Método y ruta", "Acceso", "Qué hace"],
        "widths": [2.6, 1.2, 2.8],
        "size": 9,
        "rows": [
            ["GET /api/vivo/:id", "Público", "Ruta, estado y estimación; la posición y los conteos solo para participantes"],
            ["POST /api/vivo/:id/iniciar", "Conductor dueño", "Abre o retoma el viaje del día"],
            ["POST /api/vivo/:id/posicion", "Conductor dueño", "Guarda la posición y la difunde"],
            ["PATCH /api/vivo/:id/estado", "Conductor dueño", "Cambia el estado del viaje"],
            ["POST /api/vivo/:id/finalizar", "Conductor dueño", "Cierra el viaje y borra la posición"],
            ["POST /api/vivo/:id/solicitar", "Sesión", "Crea una solicitud pendiente con código"],
            ["GET /api/vivo/:id/solicitudes", "Conductor dueño", "Lista solicitudes con distancia y estimación"],
            ["POST …/solicitudes/:codigo/aceptar", "Conductor dueño", "Acepta y consume un asiento en una transacción"],
            ["POST …/solicitudes/:codigo/rechazar", "Conductor dueño", "Rechaza sin consumir asiento"],
            ["POST /api/vivo/:id/avisar", "Pasajero confirmado", "Avisa al conductor que ya espera"],
            ["GET /api/vivo/:id/notificaciones", "Conductor o admin", "Bitácora de avisos del viaje"],
            ["POST /api/vivo/ws-ticket", "Sesión", "Emite un ticket de 60 s para abrir el WebSocket"],
        ],
    }),
    ("p", "La estimación de llegada se calcula en el servidor. La ruta de cada zona se guarda como una lista de "
          "coordenadas; el servicio proyecta la posición del auto sobre ese trazo, mide la distancia que falta "
          "hasta la parada con la fórmula del haversine y la divide entre la velocidad reportada, con un margen "
          "del 15 % y un mínimo de un minuto. Las posiciones con más de 90 segundos se descartan y las lecturas con "
          "precisión peor a 30 metros se rechazan."),

    ("h2", "4.3 Canal en tiempo real"),
    ("p", "El WebSocket comparte el puerto del servidor HTTP. Antes de abrirlo, el cliente pide a "
          "/api/vivo/ws-ticket un token de 60 segundos con una audiencia propia; así el JWT de la sesión no viaja "
          "en la URL. Al recibir la conexión, el servidor verifica el ticket, consulta al usuario en la base de "
          "datos, rechaza orígenes no permitidos en producción y limita el tamaño (4 KB) y la frecuencia de los "
          "mensajes. Cada mensaje entrante se valida con un esquema zod: suscribir, posición o ping."),
    ("p", "Las conexiones se agrupan en salas por raite y fecha. Cuando el conductor envía una posición, el "
          "servidor la guarda, recalcula la estimación para cada suscriptor según su parada y le envía solo lo que "
          "puede ver. Si alguien deja de ser participante, recibe un error y sale de la sala. Si el canal falla, la "
          "vista del navegador vuelve a consultar la API cada 20 segundos."),

    ("h2", "4.4 Autenticación y autorización"),
    ("p", "El registro solo acepta correos institucionales y guarda la contraseña con bcrypt. El inicio de sesión "
          "emite un JWT de siete días que el cliente conserva en el dispositivo. En cada petición protegida, el "
          "middleware requireAuth verifica la firma y vuelve a leer al usuario en la base de datos: si la cuenta "
          "se eliminó, la sesión deja de valer, y si un administrador cambió su rol, el cambio surte efecto sin "
          "volver a iniciar sesión. Los roles son pasajero, conductor y admin; las rutas de conductor comprueban "
          "también que el raite sea suyo."),

    ("h2", "4.5 Validación y manejo de errores"),
    ("p", "Los cuerpos, parámetros y consultas pasan por esquemas zod antes de llegar al controlador. Los errores "
          "siempre tienen la forma { error: { code, message, details } } y un código HTTP coherente: 400 para datos "
          "inválidos, 401 sin sesión, 403 sin permiso, 404 si no existe y 409 para conflictos. Una solicitud "
          "duplicada, incluso si llegan dos al mismo tiempo, se detecta por el índice único y responde 409 "
          "SOLICITUD_DUPLICADA. Aceptar una solicitud bloquea el raite dentro de una transacción para que dos "
          "aceptaciones simultáneas no vendan el mismo asiento."),

    ("h2", "4.6 Notificaciones push ligadas al viaje"),
    ("p", "Cada aviso del viaje pasa por notificarViaje, que primero lo registra en notificaciones_log y después "
          "lo envía con web-push a las suscripciones del destinatario. El resultado queda guardado: enviado, "
          "sin_suscripcion u omitido. El conductor recibe las solicitudes y los avisos de «ya te espero»; el "
          "pasajero recibe la aceptación o el rechazo, el inicio del viaje, el fin y un aviso de proximidad "
          "cuando el auto está a tres minutos o menos de su parada. Ese aviso de proximidad se calcula en el "
          "servidor con cada posición, por lo que llega aunque el pasajero tenga la aplicación cerrada, y el "
          "índice parcial de la migración 004 garantiza que se envíe una sola vez por viaje."),

    ("h2", "4.7 Caché y funcionamiento sin conexión"),
    ("p", "En el servidor, las lecturas públicas (zonas, raites, testimonios, preguntas frecuentes, configuración "
          "y estadísticas) se guardan en una caché en memoria con tiempo de vida. Cada respuesta indica X-Cache: "
          "HIT o MISS, lleva ETag y responde 304 si el navegador ya tiene la versión vigente; cualquier escritura "
          "exitosa vacía la caché para no mostrar lugares libres desactualizados."),
    ("p", "En el cliente, el service worker precachea la aplicación en la caché versionada rodando-utp-v7 y usa la "
          "estrategia red primero con respaldo en caché. Las rutas con datos personales (sesión, reservas, "
          "administración, push y seguimiento en vivo) nunca se guardan en la caché compartida. La vista en vivo "
          "guarda por separado la última posición conocida en rodando-live-v1 para mostrarla sin conexión; esa "
          "caché se borra al cerrar sesión, al finalizar el viaje y al cancelar o ser rechazado."),

    ("h2", "4.8 Privacidad de la ubicación"),
    ("p", "La posición del auto es un dato sensible. Solo la ven el conductor y los pasajeros con solicitud "
          "pendiente o confirmada; cualquier otra persona ve la ruta y la estimación, pero no el auto ni cuántas "
          "personas viajan. El GPS se comparte solo mientras el conductor tiene la página abierta y pulsa "
          "«Iniciar»; al finalizar, la posición se borra de la base de datos."),

    ("h1", "5. Lista de cotejo"),
    ("p", "La Tabla 3 aplica la lista de cotejo de diecisiete criterios a Rodando UTP. La columna de código indica "
          "la ruta del archivo y la línea donde empieza la implementación; las líneas se calcularon a partir del "
          "código entregado. Como se indicó en clase, los criterios 12 y 13 se evalúan como uno solo, al igual que "
          "los criterios 15, 16 y 17."),
    ("cotejo", {
        "num": "Tabla 3",
        "titulo": "Lista de cotejo de la PWA aplicada a Rodando UTP",
        "headers": ["N.º", "Criterio", "Qué se comprueba", "Cómo se cumple", "Ubicación en el código", "Evidencia"],
        "widths": [0.33, 0.95, 1.1, 1.85, 2.3, 0.72],
        "size": 7.5,
        "rows": COTEJO,
    }),

    ("h1", "6. Evidencias"),
    ("p", "Las capturas se tomaron el 15 de noviembre de 2026 sobre la aplicación publicada en "
          f"{URL_APP}, con Google Chrome controlado por su protocolo de depuración. Las vistas de teléfono emulan "
          "las dimensiones y el agente de usuario de un Android o un iPhone; no sustituyen una prueba en un "
          "dispositivo físico. El script que las genera está en docs/subproducto7/capturar.mjs. La vista del mapa con "
          "el auto en movimiento se muestra en la exposición, porque los raites solo salen de lunes a sábado; su "
          "funcionamiento queda respaldado por la bitácora de la Figura 9 y por las pruebas de la Figura 12."),
    ("figura", {"file": "01-inicio-escritorio.png", "width": 6.0,
                "caption": "Figura 1. Inicio en escritorio a 1440 píxeles: menú completo en una línea, acceso a "
                           "«En vivo» y a la cuenta (criterios 6 y 10)."}),
    ("figura", {"file": "02-inicio-movil.png", "width": 2.6,
                "caption": "Figura 2. La misma página a 390 píxeles con agente de usuario de Android: menú "
                           "plegable, botón de instalación y sin desplazamiento horizontal (criterios 6, 9 y 10)."}),
    ("figura", {"file": "03-instalacion-ios.png", "width": 2.6,
                "caption": "Figura 3. En iPhone no existe el aviso automático de instalación; el botón muestra los "
                           "pasos de Safari para agregar la PWA a la pantalla de inicio (criterios 1 y 9)."}),
    ("figura", {"file": "04-manifest-iconos.png", "width": 6.0,
                "caption": "Figura 4. Manifiesto servido por producción e iconos declarados, incluido el maskable "
                           "y el de iOS (criterios 2 y 4)."}),
    ("figura", {"file": "05-https.png", "width": 6.0,
                "caption": "Figura 5. Cabeceras de la respuesta HTTPS de producción: Strict-Transport-Security, "
                           "Content-Security-Policy y protecciones de helmet (criterio 3)."}),
    ("figura", {"file": "06-service-worker.png", "width": 6.0,
                "caption": "Figura 6. Registro del service worker leído en el navegador: contexto seguro, sw.js "
                           "activo, página controlada y 38 recursos en rodando-utp-v7 (criterios 5 y 7)."}),
    ("figura", {"file": "07-cache-api.png", "width": 6.0,
                "caption": "Figura 7. Laboratorio de la Cache API con la bitácora de la demostración automática: "
                           "caches.open, keys y has; cache.put, match, add y delete (criterio 8)."}),
    ("figura", {"file": "08-sin-conexion.png", "width": 6.0,
                "caption": "Figura 8. La aplicación sin red: la página se sirve desde la caché, los raites se "
                           "muestran con la última copia y la sesión «Pasajero» se conserva (criterios 12 y 13)."}),
    ("figura", {"file": "11-bitacora.png", "width": 6.0,
                "caption": "Figura 9. Bitácora de avisos push de un viaje de prueba en producción (raite 2, programado "
                           "para el lunes 16 y ejecutado dos veces la noche del 15). «enviado» indica que el servicio "
                           "push aceptó el mensaje; «sin_suscripcion», que el destinatario aún no tenía un navegador "
                           "suscrito (criterios 14 y 15)."}),
    ("figura", {"file": "10-swagger-vivo.png", "width": 6.0,
                "caption": "Figura 10. Documentación OpenAPI en /api/docs con las rutas del seguimiento en vivo, "
                           "el ticket y el WebSocket (criterios 16 y 17)."}),
    ("figura", {"file": "14-base-de-datos.png", "width": 6.0,
                "caption": "Figura 11. Tablas del seguimiento en vivo y migraciones aplicadas, en una base local "
                           "creada con las mismas migraciones que producción (criterio 15)."}),

    ("h1", "7. Pruebas"),
    ("p", "El backend tiene 50 pruebas automatizadas en siete archivos. Corren con Vitest y Supertest contra una "
          "base PostgreSQL real que se reinicia en cada ejecución, de modo que prueban las consultas, las "
          "restricciones y las transacciones, no simulaciones. La Tabla 4 las agrupa y la Figura 12 muestra la "
          "ejecución completa."),
    ("tabla", {
        "num": "Tabla 4",
        "titulo": "Pruebas automatizadas del backend",
        "headers": ["Archivo", "Casos", "Qué verifica"],
        "widths": [1.5, 0.6, 4.5],
        "size": 9,
        "rows": [
            ["vivo.test.js", "8", "Estado público sin posición, permisos del conductor, filtro de precisión, "
             "solicitudes y cupo, estimación, 409 por duplicado, bitácora push y difusión por WebSocket"],
            ["auth.test.js", "12", "Registro, inicio de sesión, correo institucional, rol leído de la base, cuenta "
             "eliminada, solicitudes de conductor y rutas push"],
            ["reservas.test.js", "6", "Apartar y cancelar, reglas de reserva y concurrencia: 8 solicitudes por 3 "
             "lugares dan exactamente 3 éxitos"],
            ["raites.test.js", "8", "Listado, filtros y CRUD del conductor dueño"],
            ["admin.test.js", "4", "Acceso exclusivo del administrador y CRUD de catálogos y usuarios"],
            ["cache.test.js", "4", "HIT y MISS, 304 con ETag, invalidación al escribir y estadísticas"],
            ["basico.test.js", "8", "Health check, catálogo, errores uniformes y calculadora"],
        ],
    }),
    ("figura", {"file": "13-pruebas.png", "width": 6.0,
                "caption": "Figura 12. Ejecución de las 50 pruebas (7 archivos aprobados) y de ESLint sin errores."}),

    ("h1", "8. Alcance y limitaciones"),
    ("p", "Todo lo descrito en las secciones 4 a 7 funciona en la aplicación publicada. Los siguientes puntos son "
          "límites reales del prototipo y conviene conocerlos antes de usarlo con más personas:"),
    ("ul", [
        "Una sola instancia: las salas del WebSocket viven en la memoria del proceso. Con varias instancias haría "
        "falta un canal compartido, por ejemplo LISTEN/NOTIFY de PostgreSQL.",
        "Plan gratuito de Render: el servicio se suspende tras un periodo sin uso y la primera petición tarda "
        "varios segundos en despertarlo; la base de datos gratuita caduca a los 30 días (Render, s. f.).",
        "GPS en primer plano: el navegador solo entrega la ubicación mientras la página del conductor está "
        "abierta; en segundo plano el sistema operativo puede suspender el envío.",
        "Push en iPhone: requiere iOS 16.4 o posterior y la PWA agregada a la pantalla de inicio (WebKit, 2023).",
        "Mapa sin conexión: solo están disponibles los mosaicos del mapa que ya se habían visitado.",
        "Pruebas en dispositivos: las vistas móviles se verificaron con emulación de Chrome; falta repetirlas en "
        "un teléfono Android y un iPhone físicos.",
    ]),

    ("h1", "9. Conclusiones"),
    ("p", "El backend convierte la propuesta del Subproducto 5 en un servicio que funciona: guarda el estado de "
          "cada viaje, calcula la llegada a cada parada, reparte la posición al instante solo a quien participa y "
          "avisa con notificaciones push en los momentos que importan. La lista de cotejo muestra que los "
          "diecisiete criterios tienen una implementación identificable en el código y una evidencia en la "
          "aplicación publicada."),
    ("p", "Los criterios que suelen quedar débiles en una PWA (actualización de datos, base de datos, backend y "
          "notificaciones) son justamente los que este trabajo refuerza: la actualización ocurre por WebSocket "
          "con respaldo por consulta periódica, la base de datos tiene migraciones y restricciones que evitan "
          "estados inválidos, el servidor valida y autoriza cada operación, y cada notificación deja constancia "
          "de si llegó o por qué no."),
    ("p", "El siguiente paso es probar el flujo completo en teléfonos físicos con conductores y pasajeros reales, "
          "y preparar el canal en tiempo real para varias instancias antes de crecer el número de usuarios."),

    ("h1", "10. Referencias"),
    ("refs", [
        "Express. (s. f.). Express: Fast, unopinionated, minimalist web framework for Node.js. https://expressjs.com/",
        "Fette, I., y Melnikov, A. (2011). The WebSocket protocol (RFC 6455). Internet Engineering Task Force. "
        "https://www.rfc-editor.org/rfc/rfc6455",
        "Jones, M., Bradley, J., y Sakimura, N. (2015). JSON Web Token (JWT) (RFC 7519). Internet Engineering Task "
        "Force. https://www.rfc-editor.org/rfc/rfc7519",
        "MDN Web Docs. (s. f.-a). Cache. https://developer.mozilla.org/es/docs/Web/API/Cache",
        "MDN Web Docs. (s. f.-b). Geolocation API. https://developer.mozilla.org/es/docs/Web/API/Geolocation_API",
        "MDN Web Docs. (s. f.-c). Service Worker API. https://developer.mozilla.org/es/docs/Web/API/Service_Worker_API",
        "MDN Web Docs. (s. f.-d). Strict-Transport-Security. "
        "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
        "MDN Web Docs. (s. f.-e). Web application manifest. "
        "https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest",
        "MDN Web Docs. (s. f.-f). WebSockets API. https://developer.mozilla.org/es/docs/Web/API/WebSockets_API",
        "PostgreSQL Global Development Group. (s. f.). PostgreSQL 16 documentation. https://www.postgresql.org/docs/16/",
        "Render. (s. f.). Deploy for free. https://render.com/docs/free",
        "Thomson, M., Damaggio, E., y Raymor, B. (2016). Generic event delivery using HTTP push (RFC 8030). "
        "Internet Engineering Task Force. https://www.rfc-editor.org/rfc/rfc8030",
        "Thomson, M., y Beverloo, P. (2017). Voluntary application server identification (VAPID) for web push "
        "(RFC 8292). Internet Engineering Task Force. https://www.rfc-editor.org/rfc/rfc8292",
        "web.dev. (s. f.). Learn PWA. https://web.dev/learn/pwa",
        "WebKit. (2023, 16 de febrero). Web push for web apps on iOS and iPadOS. "
        "https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/",
        "web-push-libs. (s. f.). web-push. GitHub. https://github.com/web-push-libs/web-push",
        "websockets. (s. f.). ws: a Node.js WebSocket library. GitHub. https://github.com/websockets/ws",
        "Zod. (s. f.). Zod documentation. https://zod.dev/",
    ]),

    ("h1", "Apéndice A. Correspondencia con lo solicitado"),
    ("tabla", {
        "num": "Tabla A1",
        "titulo": "Correspondencia entre la actividad y el reporte",
        "headers": ["Lo que pide la actividad", "Dónde se atiende", "Sección"],
        "widths": [2.3, 3.2, 0.9],
        "size": 9.5,
        "rows": [
            ["Desarrollo individual del backend", "Servidor del seguimiento en vivo de Fortino Romero Mantilla", "4"],
            ["Sobre la propuesta del Subproducto 5", "Rodando UTP Live: posición, estimación, solicitudes y avisos", "2, 4"],
            ["Lista de cotejo de al menos 12 características", "17 criterios con implementación, código y evidencia", "5"],
            ["Ubicación de cada criterio en el código", "Columna «Ubicación en el código» con ruta y línea", "5"],
            ["Evidencia del funcionamiento", "12 figuras tomadas de la aplicación publicada", "6, 7"],
            ["Reporte en PDF", "Este documento", "—"],
        ],
    }),

    ("h1", "Apéndice B. Enlaces de la entrega"),
    ("p", "Aplicación publicada (PWA): " + URL_APP),
    ("p", "Seguimiento en vivo: " + URL_APP + "/vivo.html"),
    ("p", "Documentación de la API: " + URL_APP + "/api/docs"),
    ("p", "Código fuente del proyecto: " + REPO),
]


# ══════════════════════════════════════════════════════════════════════════════
# DOCX
# ══════════════════════════════════════════════════════════════════════════════
def construir_docx():
    doc = Document()
    for s in doc.sections:
        s.top_margin = s.bottom_margin = s.left_margin = s.right_margin = Inches(1)

    estilo = doc.styles["Normal"]
    estilo.font.name = "Times New Roman"
    estilo.font.size = Pt(12)
    estilo.paragraph_format.space_before = Pt(0)
    estilo.paragraph_format.space_after = Pt(0)

    def numeracion(section):
        para = section.header.paragraphs[0]
        para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run = para.add_run()
        run.font.name = "Times New Roman"
        run.font.size = Pt(12)
        ini = OxmlElement("w:fldChar"); ini.set(qn("w:fldCharType"), "begin")
        instr = OxmlElement("w:instrText"); instr.text = "PAGE"
        fin = OxmlElement("w:fldChar"); fin.set(qn("w:fldCharType"), "end")
        run._r.append(ini); run._r.append(instr); run._r.append(fin)

    numeracion(doc.sections[0])

    def p(texto="", bold=False, italic=False, size=12, align=WD_ALIGN_PARAGRAPH.LEFT, spacing=2.0):
        para = doc.add_paragraph()
        para.alignment = align
        para.paragraph_format.line_spacing = Pt(size * spacing)
        if texto:
            run = para.add_run(texto)
            run.bold = bold
            run.italic = italic
            run.font.name = "Times New Roman"
            run.font.size = Pt(size)
        return para

    def h1(texto):
        if texto in BREAKS:
            doc.add_page_break()
        else:
            p()
        p(texto, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)

    def body(texto):
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        pf = para.paragraph_format
        pf.line_spacing = Pt(24)
        pf.first_line_indent = Cm(1.27)
        run = para.add_run(texto)
        run.font.name = "Times New Roman"
        run.font.size = Pt(12)

    def vineta(texto):
        para = doc.add_paragraph(style="List Bullet")
        para.paragraph_format.line_spacing = Pt(24)
        para.paragraph_format.left_indent = Cm(1.27)
        run = para.add_run(texto)
        run.font.name = "Times New Roman"
        run.font.size = Pt(12)

    def tabla_p(t, mono_col=None):
        tbl = doc.add_table(rows=1, cols=len(t["headers"]))
        tbl.style = "Table Grid"
        for i, texto in enumerate(t["headers"]):
            celda = tbl.rows[0].cells[i]
            celda.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            run = celda.paragraphs[0].add_run(texto)
            run.bold = True
            run.font.name = "Times New Roman"
            run.font.size = Pt(t.get("size", 10))
        for fila in t["rows"]:
            celdas = tbl.add_row().cells
            for i, texto in enumerate(fila):
                run = celdas[i].paragraphs[0].add_run(texto)
                run.font.name = "Courier New" if i == mono_col else "Times New Roman"
                run.font.size = Pt(t.get("size", 10) - (0.5 if i == mono_col else 0))
        for fila in tbl.rows:
            for i, celda in enumerate(fila.cells):
                celda.width = Inches(t["widths"][i])
        return tbl

    def figura(t):
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        para.paragraph_format.space_before = Pt(10)
        para.paragraph_format.keep_with_next = True
        para.add_run().add_picture(str(IMG / t["file"]), width=Inches(min(t.get("width", 5.5), 6.3)))
        cap = doc.add_paragraph()
        cap.paragraph_format.keep_together = True
        cap.paragraph_format.space_after = Pt(8)
        run = cap.add_run(t["caption"])
        run.font.name = "Times New Roman"
        run.font.size = Pt(11)
        run.italic = True

    # portada
    for _ in range(5):
        p()
    p(PORTADA["institucion"], bold=True, size=14, align=WD_ALIGN_PARAGRAPH.CENTER)
    p(PORTADA["division"], bold=True, size=13, align=WD_ALIGN_PARAGRAPH.CENTER)
    for _ in range(3):
        p()
    p(PORTADA["tipo"], bold=True, size=15, align=WD_ALIGN_PARAGRAPH.CENTER)
    p(PORTADA["titulo"], bold=True, size=17, align=WD_ALIGN_PARAGRAPH.CENTER)
    p(PORTADA["subtitulo"], size=13, align=WD_ALIGN_PARAGRAPH.CENTER)
    for _ in range(4):
        p()
    p(PORTADA["alumno"], size=13, align=WD_ALIGN_PARAGRAPH.CENTER)
    p(PORTADA["carrera"], align=WD_ALIGN_PARAGRAPH.CENTER)
    p()
    p(PORTADA["materia"], align=WD_ALIGN_PARAGRAPH.CENTER)
    p(PORTADA["docente"], align=WD_ALIGN_PARAGRAPH.CENTER)
    p()
    p(PORTADA["periodo"], align=WD_ALIGN_PARAGRAPH.CENTER)
    p(PORTADA["fecha"], align=WD_ALIGN_PARAGRAPH.CENTER)

    # índice
    doc.add_page_break()
    p("Índice", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    p()
    for texto, nivel in INDICE:
        p(("    " * nivel) + texto, spacing=1.5)

    for tipo, dato in CONTENIDO:
        if tipo == "h1":
            h1(dato)
        elif tipo == "h2":
            p(dato, bold=True)
        elif tipo == "p":
            body(dato)
        elif tipo == "ul":
            for item in dato:
                vineta(item)
        elif tipo in ("tabla", "cotejo"):
            p(dato["num"], bold=True)
            p(dato["titulo"], italic=True)
            tabla_p(dato, mono_col=4 if tipo == "cotejo" else None)
            p()
        elif tipo == "figura":
            figura(dato)
        elif tipo == "refs":
            for r in dato:
                para = doc.add_paragraph()
                pf = para.paragraph_format
                pf.line_spacing = Pt(24)
                pf.left_indent = Cm(1.27)
                pf.first_line_indent = Cm(-1.27)
                run = para.add_run(r)
                run.font.name = "Times New Roman"
                run.font.size = Pt(12)

    doc.save(str(DOCX))


# ══════════════════════════════════════════════════════════════════════════════
# HTML (para imprimir a PDF)
# ══════════════════════════════════════════════════════════════════════════════
def construir_html():
    e = lambda s: html.escape(s, quote=False)
    partes = [f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{e(PORTADA['titulo'])}</title>
<style>
@page {{ size: A4; }}
html {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
body {{ margin:0; font-family:"Times New Roman","Liberation Serif",serif; font-size:12pt; line-height:2; color:#000; }}
h1 {{ font-size:12pt; font-weight:700; text-align:center; margin:0; page-break-after:avoid; }}
h1.pb {{ page-break-before:always; }}
h2 {{ font-size:12pt; font-weight:700; text-align:left; margin:0; page-break-after:avoid; }}
p {{ margin:0; text-align:justify; text-indent:1.27cm; hyphens:auto; }}
ul {{ margin:0; padding-left:1.0cm; }}
li {{ text-align:justify; margin:0; }}
.cap {{ font-style:italic; font-size:11pt; text-indent:0; margin:4pt 0 12pt 0; line-height:1.4; text-align:left; }}
.tnum {{ font-weight:700; text-indent:0; margin:16pt 0 0 0; page-break-after:avoid; }}
.ttit {{ font-style:italic; text-indent:0; margin:0 0 4pt 0; page-break-after:avoid; }}
table {{ width:100%; border-collapse:collapse; font-size:9pt; line-height:1.35; margin:0 0 10pt 0; table-layout:fixed; }}
thead {{ display:table-header-group; }}
tr {{ page-break-inside:avoid; break-inside:avoid; }}
th {{ border-top:1px solid #000; border-bottom:1px solid #000; text-align:left; padding:3pt 4pt; font-weight:700; }}
td {{ padding:3pt 4pt; vertical-align:top; border-bottom:.4pt solid #999; overflow-wrap:anywhere; }}
tr:last-child td {{ border-bottom:1px solid #000; }}
td.code {{ font-family:"Courier New","Liberation Mono",monospace; font-size:6.6pt; white-space:pre-line; }}
table.cotejo {{ font-size:7.6pt; line-height:1.3; }}
figure {{ margin:10pt 0 0 0; text-align:center; break-inside:avoid; page-break-inside:avoid; }}
figure img {{ height:auto; border:.5pt solid #999; }}
.refs li {{ text-align:left; overflow-wrap:anywhere; }}
.cover {{ height:24.4cm; display:flex; flex-direction:column; justify-content:center; text-align:center; }}
.cover p {{ text-indent:0; text-align:center; line-height:1.5; margin:0; }}
.cover .inst {{ font-weight:700; font-size:14pt; }}
.cover .div {{ font-weight:700; font-size:13pt; }}
.cover .tipo {{ font-weight:700; font-size:15pt; margin-top:2.2cm; }}
.cover .tit {{ font-weight:700; font-size:17pt; line-height:1.3; margin:6pt 0; }}
.cover .sub {{ font-size:13pt; margin-bottom:2.4cm; }}
.cover .alumno {{ font-size:13pt; margin-bottom:10pt; }}
.cover .sp {{ margin:14pt 0; }}
.idx p {{ text-indent:0; line-height:1.6; }}
</style>
</head>
<body>
<div class="cover">
  <p class="inst">{e(PORTADA['institucion'])}</p>
  <p class="div">{e(PORTADA['division'])}</p>
  <p class="tipo">{e(PORTADA['tipo'])}</p>
  <p class="tit">{e(PORTADA['titulo'])}</p>
  <p class="sub">{e(PORTADA['subtitulo'])}</p>
  <p class="alumno"><b>{e(PORTADA['alumno'])}</b></p>
  <p>{e(PORTADA['carrera'])}</p>
  <p class="sp">{e(PORTADA['materia'])}</p>
  <p>{e(PORTADA['docente'])}</p>
  <p class="sp">{e(PORTADA['periodo'])}</p>
  <p>{e(PORTADA['fecha'])}</p>
</div>
<h1 class="pb">Índice</h1>
<div class="idx">"""]
    for texto, nivel in INDICE:
        estilo = "margin-left:1cm" if nivel else ""
        partes.append(f'<p style="{estilo}">{e(texto)}</p>')
    partes.append("</div>")

    for tipo, dato in CONTENIDO:
        if tipo == "h1":
            clase = ' class="pb"' if dato in BREAKS else ""
            partes.append(f"<h1{clase}>{e(dato)}</h1>")
        elif tipo == "h2":
            partes.append(f"<h2>{e(dato)}</h2>")
        elif tipo == "p":
            partes.append(f"<p>{e(dato)}</p>")
        elif tipo == "ul":
            partes.append("<ul>" + "".join(f"<li>{e(i)}</li>" for i in dato) + "</ul>")
        elif tipo in ("tabla", "cotejo"):
            es_cotejo = tipo == "cotejo"
            filas = "".join(
                "<tr>" + "".join(
                    f'<td class="code">{e(c)}</td>' if es_cotejo and i == 4 else f"<td>{e(c)}</td>"
                    for i, c in enumerate(fila)) + "</tr>"
                for fila in dato["rows"]
            )
            enc = "".join(f"<th>{e(h)}</th>" for h in dato["headers"])
            total = sum(dato["widths"])
            cols = "".join(f'<col style="width:{w / total * 100:.1f}%">' for w in dato["widths"])
            clase = ' class="cotejo"' if es_cotejo else ""
            partes.append(
                f'<p class="tnum">{e(dato["num"])}</p><p class="ttit">{e(dato["titulo"])}</p>'
                f"<table{clase}><colgroup>{cols}</colgroup><thead><tr>{enc}</tr></thead><tbody>{filas}</tbody></table>"
            )
        elif tipo == "figura":
            ancho = dato.get("width", 5.5)
            partes.append(
                f'<figure><img src="../img/{dato["file"]}" alt="" style="width:{ancho}in;max-width:100%">'
                f'<figcaption class="cap">{e(dato["caption"])}</figcaption></figure>'
            )
        elif tipo == "refs":
            partes.append('<ul class="refs" style="list-style:none;padding-left:1.27cm">'
                          + "".join(f'<li style="text-indent:-1.27cm;padding-left:1.27cm">{e(r)}</li>' for r in dato)
                          + "</ul>")
    partes.append("</body></html>")
    HTML.write_text("\n".join(partes), encoding="utf-8")


if __name__ == "__main__":
    faltan = [d["file"] for t, d in CONTENIDO if t == "figura" and not (IMG / d["file"]).exists()]
    if faltan:
        raise SystemExit("Faltan capturas: " + ", ".join(faltan))
    construir_docx()
    construir_html()
    print("DOCX:", DOCX)
    print("HTML:", HTML)
