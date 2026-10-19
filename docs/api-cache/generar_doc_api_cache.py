"""
Genera el documento APA 7 del Subproducto No. 4 «API caché»:
cómo funciona la caché en una PWA, métodos de la Cache Storage API
y su implementación en la PWA Rodando UTP.

Uso:  python3 generar_doc_api_cache.py
Salida: docs/api-cache/API_Cache_PWA_Rodando_UTP.docx
"""
from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor

BASE = Path(__file__).resolve().parent
IMG = BASE / "img"
SALIDA = BASE / "API_Cache_PWA_Rodando_UTP.docx"

# ── Datos que se actualizan al publicar ───────────────────────────────────────
URL_APP = "https://rodando-utp.onrender.com"
REPO = "https://github.com/<usuario>/rodando-utp"
FECHA = "18 de octubre de 2026"
PERIODO = "Periodo Septiembre–Diciembre 2026"

doc = Document()

# ── Márgenes APA 7 (2.54 cm) ──────────────────────────────────────────────────
for seccion in doc.sections:
    seccion.top_margin = Inches(1)
    seccion.bottom_margin = Inches(1)
    seccion.left_margin = Inches(1)
    seccion.right_margin = Inches(1)

# ── Estilo base ───────────────────────────────────────────────────────────────
estilo = doc.styles["Normal"]
estilo.font.name = "Times New Roman"
estilo.font.size = Pt(12)
estilo.paragraph_format.space_before = Pt(0)
estilo.paragraph_format.space_after = Pt(0)


def numeracion(section):
    """Número de página en la esquina superior derecha (APA 7)."""
    para = section.header.paragraphs[0] if section.header.paragraphs else section.header.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = para.add_run()
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    ini = OxmlElement("w:fldChar"); ini.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText"); instr.text = "PAGE"
    fin = OxmlElement("w:fldChar"); fin.set(qn("w:fldCharType"), "end")
    run._r.append(ini); run._r.append(instr); run._r.append(fin)


numeracion(doc.sections[0])


def p(texto="", bold=False, italic=False, size=12, align=WD_ALIGN_PARAGRAPH.LEFT,
      spacing=2.0, before=0, after=0, color=None, font="Times New Roman"):
    para = doc.add_paragraph()
    para.alignment = align
    pf = para.paragraph_format
    pf.line_spacing = Pt(size * spacing)
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    if texto:
        run = para.add_run(texto)
        run.bold = bold
        run.italic = italic
        run.font.name = font
        run.font.size = Pt(size)
        if color:
            run.font.color.rgb = RGBColor(*color)
    return para


def h1(texto):
    return p(texto, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, before=12)


def h2(texto):
    return p(texto, bold=True, before=12)


def h3(texto):
    return p(texto, bold=True, italic=True, before=8)


def body(texto):
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pf = para.paragraph_format
    pf.line_spacing = Pt(24)
    pf.first_line_indent = Cm(1.27)
    run = para.add_run(texto)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    return para


def vineta(texto):
    para = doc.add_paragraph(style="List Bullet")
    pf = para.paragraph_format
    pf.line_spacing = Pt(24)
    pf.left_indent = Cm(1.27)
    run = para.add_run(texto)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    return para


def blank(n=1):
    for _ in range(n):
        para = doc.add_paragraph()
        para.paragraph_format.line_spacing = Pt(24)


def codigo(texto):
    """Bloque de código con fondo gris claro."""
    para = doc.add_paragraph()
    pf = para.paragraph_format
    pf.line_spacing = Pt(12)
    pf.space_before = Pt(6)
    pf.space_after = Pt(6)
    pf.left_indent = Cm(0.5)
    run = para.add_run(texto)
    run.font.name = "Consolas"
    run.font.size = Pt(9)
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), "F2F2F2")
    para._p.get_or_add_pPr().append(shd)
    return para


def tabla(encabezados, filas, size=10):
    t = doc.add_table(rows=1, cols=len(encabezados))
    t.style = "Table Grid"
    for i, texto in enumerate(encabezados):
        celda = t.rows[0].cells[i]
        celda.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        run = celda.paragraphs[0].add_run(texto)
        run.bold = True
        run.font.name = "Times New Roman"
        run.font.size = Pt(size)
    for fila in filas:
        celdas = t.add_row().cells
        for i, texto in enumerate(fila):
            run = celdas[i].paragraphs[0].add_run(texto)
            run.font.name = "Times New Roman"
            run.font.size = Pt(size)
            if texto.startswith("`") and texto.endswith("`"):
                run.font.name = "Consolas"
                run.text = texto.strip("`")
    return t


def figura(archivo, caption, ancho=Inches(6.3)):
    ruta = IMG / archivo
    if not ruta.exists():
        return
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    para.paragraph_format.space_before = Pt(8)
    para.add_run().add_picture(str(ruta), width=ancho)
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.LEFT
    cap.paragraph_format.space_after = Pt(10)
    run = cap.add_run(caption)
    run.font.name = "Times New Roman"
    run.font.size = Pt(11)
    run.italic = True


# ══════════════════════════════════════════════════════════════════════════════
# PORTADA
# ══════════════════════════════════════════════════════════════════════════════
blank(5)
p("Universidad Tecnológica de Puebla", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, size=14)
p("División de Tecnologías de la Información", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, size=13)
blank(3)
p("Subproducto No. 4: API caché en una aplicación web progresiva", bold=True,
  align=WD_ALIGN_PARAGRAPH.CENTER, size=16)
p("Implementación y análisis de la Cache Storage API en la PWA Rodando UTP",
  align=WD_ALIGN_PARAGRAPH.CENTER, size=13)
blank(4)
p("Fortino Romero Mantilla", align=WD_ALIGN_PARAGRAPH.CENTER)
p("Desarrollo de Software Multiplataforma", align=WD_ALIGN_PARAGRAPH.CENTER)
blank()
p("10 A – Aplicaciones Web Progresivas", align=WD_ALIGN_PARAGRAPH.CENTER)
p("Mtra. Xóchitl Mendoza Píscil", align=WD_ALIGN_PARAGRAPH.CENTER)
blank()
p(PERIODO, align=WD_ALIGN_PARAGRAPH.CENTER)
p(FECHA, align=WD_ALIGN_PARAGRAPH.CENTER)
doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════════════
# ÍNDICE
# ══════════════════════════════════════════════════════════════════════════════
h1("Índice")
blank()
indice = [
    "1. Introducción",
    "2. ¿Qué es la caché en una PWA y cómo funciona?",
    "    2.1 El service worker como intermediario de red",
    "    2.2 Ciclo de vida: install, fetch y activate",
    "    2.3 Estrategias de caché",
    "    2.4 Caché HTTP frente a Cache Storage",
    "    2.5 Cuota, persistencia y depuración",
    "3. Métodos principales de la Cache API",
    "    3.1 La interfaz CacheStorage (objeto caches)",
    "    3.2 La interfaz Cache",
    "    3.3 Ejemplo mínimo de uso",
    "4. Implementación en la PWA Rodando UTP",
    "    4.1 Arquitectura de la aplicación",
    "    4.2 Qué se cachea y qué no",
    "    4.3 Código del service worker",
    "    4.4 Laboratorio de caché",
    "    4.5 Verificación y resultados",
    "    4.6 Caché del lado del servidor",
    "5. Conclusiones",
    "6. Referencias",
    "Apéndice A. Enlaces de la entrega",
]
for linea in indice:
    p(linea, spacing=1.5)
doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════════════
# 1. INTRODUCCIÓN
# ══════════════════════════════════════════════════════════════════════════════
h1("1. Introducción")
body(
    "Una aplicación web progresiva (PWA) es una aplicación construida con tecnologías web que se instala en el "
    "dispositivo, se comporta como una aplicación nativa y, sobre todo, funciona sin conexión. La pieza que hace "
    "posible ese comportamiento es la caché: una copia local de los archivos y de las respuestas que la aplicación "
    "necesita, guardada por el propio navegador y administrada por el programador a través de la Cache Storage API."
)
body(
    "Este documento explica qué es la caché en una PWA, cómo funciona el mecanismo que la gobierna (el service "
    "worker) y cuáles son los métodos principales de la Cache API. Después muestra su aplicación real en Rodando "
    "UTP, una PWA para compartir raite entre estudiantes de la Universidad Tecnológica de Puebla, e incluye las "
    "evidencias de su funcionamiento, tanto con conexión como sin ella."
)

# ══════════════════════════════════════════════════════════════════════════════
# 2. CÓMO FUNCIONA
# ══════════════════════════════════════════════════════════════════════════════
h1("2. ¿Qué es la caché en una PWA y cómo funciona?")
body(
    "La caché de una PWA es un almacenamiento programable del navegador llamado Cache Storage. A diferencia de la "
    "caché HTTP tradicional, que el navegador administra de forma automática según las cabeceras de cada respuesta, "
    "el Cache Storage guarda pares de petición y respuesta (Request y Response) que la aplicación decide cuándo "
    "escribir, cuándo leer y cuándo borrar. El acceso a esa memoria no lo tiene el código de la página directamente "
    "en cada carga: lo controla un service worker."
)

h2("2.1 El service worker como intermediario de red")
body(
    "Un service worker es un script que el navegador ejecuta en segundo plano, separado de la página, y que se "
    "convierte en intermediario entre la aplicación y la red. Una vez registrado y activo, toda petición que sale "
    "de la página pasa primero por él; el service worker decide si responde con la copia guardada en la caché, si "
    "va a la red o si combina ambas cosas. Esta posición privilegiada es la que permite que la aplicación siga "
    "funcionando cuando no hay conexión, porque el escritor de la caché (el service worker) y el lector son el mismo."
)
body(
    "El service worker solo funciona en contextos seguros: HTTPS o localhost. Tampoco tiene acceso al DOM, así que "
    "no puede modificar la interfaz directamente; su trabajo es interceptar peticiones y administrar la caché."
)

h2("2.2 Ciclo de vida: install, fetch y activate")
body("El ciclo de vida del service worker organiza el trabajo de la caché en tres momentos:")
vineta("install. Se ejecuta una sola vez, cuando el navegador registra el service worker. Es el momento del "
       "precaching: se abre la caché y se descargan los archivos esenciales de la aplicación (HTML, CSS, JavaScript "
       "e iconos) para que existan antes de que el usuario los necesite.")
vineta("fetch. Se ejecuta en cada petición de la página. Aquí se aplica la estrategia elegida: responder desde la "
       "caché, ir a la red o intentar una y recurrir a la otra si falla.")
vineta("activate. Se ejecuta cuando el service worker nuevo toma el control. Sirve, entre otras cosas, para limpiar "
       "las cachés de versiones anteriores y liberar espacio; también se aprovecha para reclamar las pestañas abiertas.")
body(
    "En el momento de la instalación, si el archivo no se actualiza no se vuelve a ejecutar install; por eso la "
    "caché se identifica con un nombre versionado (por ejemplo, rodando-utp-v3) y, al subir la versión, el paso "
    "activate borra la anterior."
)

h2("2.3 Estrategias de caché")
body(
    "La estrategia define el orden en que se consultan la caché y la red. Las tres más comunes se resumen en la "
    "Tabla 1."
)
p("Tabla 1", bold=True, before=8)
p("Estrategias de caché más usadas en una PWA", italic=True)
tabla(
    ["Estrategia", "Funcionamiento", "Cuándo conviene"],
    [
        ["Cache first", "Responde la copia local; solo va a la red si no la encuentra.",
         "Recursos estáticos que casi no cambian (CSS, iconos, tipografías)."],
        ["Network first", "Intenta la red y, si falla, responde la copia local.",
         "Contenido que debe estar lo más actualizado posible (datos de la API)."],
        ["Stale-while-revalidate", "Responde la copia local al instante y actualiza la caché en segundo plano.",
         "Recursos donde la rapidez importa más que mostrar la última versión."],
    ],
)
blank()

h2("2.4 Caché HTTP frente a Cache Storage")
body(
    "Las dos cachés conviven y se complementan. La caché HTTP evita descargas repetidas y responde al refresco de "
    "la página, pero no puede usarse sin conexión porque el navegador no está obligado a conservar los recursos. El "
    "Cache Storage, en cambio, es explícito y persistente: lo que la aplicación guarda sigue ahí hasta que ella "
    "misma lo borre o el navegador necesite espacio. Por eso una PWA usa Cache Storage para el arranque sin red y "
    "caché HTTP para no repetir descargas cuando sí hay conexión."
)

h2("2.5 Cuota, persistencia y depuración")
body(
    "El navegador asigna a cada origen un espacio limitado (cuota) compartido entre Cache Storage, IndexedDB y "
    "localStorage. Cuando el almacenamiento se agota, el navegador puede desalojar cachés; por ello conviene "
    "guardar solo lo necesario y liberar las versiones viejas en activate. La aplicación puede consultar su "
    "consumo con navigator.storage.estimate() y, en los navegadores que lo permiten, solicitar almacenamiento "
    "persistente con navigator.storage.persist(). Para revisar el contenido, las herramientas de desarrollo "
    "incluyen el panel Application, donde se ven las cachés, sus entradas y el service worker registrado."
)

doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════════════
# 3. MÉTODOS
# ══════════════════════════════════════════════════════════════════════════════
h1("3. Métodos principales de la Cache API")
body(
    "La Cache Storage API se organiza en dos objetos. El objeto global caches (interfaz CacheStorage) administra "
    "las cachés nombradas; cada caché (interfaz Cache) administra sus entradas. Todos los métodos devuelven "
    "promesas, porque abrir una caché, descargar un recurso o buscar una copia son operaciones asíncronas."
)

h2("3.1 La interfaz CacheStorage (objeto caches)")
p("Tabla 2", bold=True, before=8)
p("Métodos principales del objeto global caches", italic=True)
tabla(
    ["Método", "Devuelve", "Para qué sirve"],
    [
        ["`caches.open(nombre)`", "Promise<Cache>", "Abre (o crea, si no existe) una caché con ese nombre. Es el punto de entrada a todas las operaciones."],
        ["`caches.has(nombre)`", "Promise<boolean>", "Comprueba si ya existe una caché con ese nombre."],
        ["`caches.keys()`", "Promise<string[]>", "Lista los nombres de todas las cachés del origen. Se usa para localizar y borrar versiones anteriores."],
        ["`caches.delete(nombre)`", "Promise<boolean>", "Borra la caché completa. Devuelve false si no existía."],
        ["`caches.match(req, opts)`", "Promise<Response|undefined>", "Busca una petición en todas las cachés (en orden de creación) sin abrir una en concreto."],
    ],
)
blank()

h2("3.2 La interfaz Cache")
p("Tabla 3", bold=True, before=8)
p("Métodos principales de una caché (instancia de Cache)", italic=True)
tabla(
    ["Método", "Devuelve", "Para qué sirve"],
    [
        ["`add(req)`", "Promise<void>", "Descarga la URL y guarda la respuesta en un solo paso. Rechaza la promesa si la respuesta no es correcta (status fuera de 200–299)."],
        ["`addAll([reqs])`", "Promise<void>", "Igual que add() pero con una lista. Es atómico: si un recurso falla, no se guarda ninguno."],
        ["`put(req, res)`", "Promise<void>", "Guarda una Response construida por la aplicación. Permite guardar respuestas de la API o respuestas propias."],
        ["`match(req, opts)`", "Promise<Response|undefined>", "Devuelve la primera respuesta guardada que coincide con la petición (undefined si no hay)."],
        ["`matchAll(req, opts)`", "Promise<Response[]>", "Devuelve todas las coincidencias."],
        ["`delete(req, opts)`", "Promise<boolean>", "Borra solo la entrada indicada. Devuelve false si no existía."],
        ["`keys(req?, opts)`", "Promise<Request[]>", "Lista las peticiones guardadas (las claves de la caché), con filtros opcionales."],
    ],
)
blank()
body(
    "Los métodos match(), matchAll(), delete() y keys() aceptan un objeto de opciones: ignoreSearch ignora la "
    "cadena de consulta de la URL, ignoreMethod permite comparar peticiones con métodos distintos de GET y "
    "ignoreVary omite la cabecera Vary. El método caches.match() acepta además cacheName para limitar la búsqueda "
    "a una caché concreta."
)

h2("3.3 Ejemplo mínimo de uso")
body(
    "El siguiente fragmento muestra las operaciones esenciales de una PWA: precachear en install, responder desde "
    "la caché con respaldo de red en fetch y limpiar versiones anteriores en activate."
)
codigo(
    "const CACHE = \"mi-app-v1\";\n"
    "\n"
    "// 1) Precaching: guardar los archivos base durante la instalación\n"
    "self.addEventListener(\"install\", e => {\n"
    "  e.waitUntil(\n"
    "    caches.open(CACHE)                                  // caches.open()\n"
    "      .then(c => c.addAll([\"./\", \"./index.html\", \"./app.css\"]))  // cache.addAll()\n"
    "      .then(() => self.skipWaiting())\n"
    "  );\n"
    "});\n"
    "\n"
    "// 2) Lectura: primero la caché, después la red\n"
    "self.addEventListener(\"fetch\", e => {\n"
    "  if (e.request.method !== \"GET\") return;              // solo lecturas\n"
    "  e.respondWith(\n"
    "    caches.match(e.request)                              // caches.match()\n"
    "      .then(res => res || fetch(e.request).then(nueva => {\n"
    "        const copia = nueva.clone();\n"
    "        caches.open(CACHE).then(c => c.put(e.request, copia)); // cache.put()\n"
    "        return nueva;\n"
    "      }))\n"
    "  );\n"
    "});\n"
    "\n"
    "// 3) Limpieza: borrar las cachés de versiones anteriores\n"
    "self.addEventListener(\"activate\", e => {\n"
    "  e.waitUntil(\n"
    "    caches.keys()                                        // caches.keys()\n"
    "      .then(nombres => Promise.all(\n"
    "        nombres.filter(n => n !== CACHE).map(n => caches.delete(n)) // caches.delete()\n"
    "      ))\n"
    "  );\n"
    "});"
)
body(
    "Un detalle importante: la caché solo puede guardar respuestas a peticiones GET (y no fragmentos). Las "
    "escrituras (POST, PUT, PATCH, DELETE) y los datos personales no se cachean; esa regla también se aplica en la "
    "aplicación que se describe a continuación."
)

doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════════════
# 4. IMPLEMENTACIÓN
# ══════════════════════════════════════════════════════════════════════════════
h1("4. Implementación en la PWA Rodando UTP")
body(
    "Rodando UTP es una PWA para que estudiantes de la Universidad Tecnológica de Puebla compartan raite hacia el "
    "campus. Permite consultar rutas y horarios, reservar un lugar con código, calcular el ahorro de gasolina y "
    "administrar los raites publicados desde un panel. La aplicación se entregó previamente; en esta actividad se "
    "documenta y se demuestra el uso de la Cache API, y se añadió a la propia PWA un laboratorio para probar sus "
    "métodos en vivo."
)

h2("4.1 Arquitectura de la aplicación")
body(
    "El frontend es HTML, CSS y JavaScript sin frameworks, e incluye manifest.json y sw.js para el comportamiento "
    "de PWA. El backend es una API REST en Node.js con Express y PostgreSQL, servida desde el mismo origen que el "
    "frontend. Como el service worker solo intercepta lo que pasa por su origen, toda la aplicación (interfaz y "
    "API) comparte una sola caché Cache Storage."
)

h2("4.2 Qué se cachea y qué no")
body("La Tabla 4 resume la estrategia aplicada a cada tipo de recurso.")
p("Tabla 4", bold=True, before=8)
p("Estrategias de caché utilizadas en Rodando UTP", italic=True)
tabla(
    ["Recurso", "Estrategia", "Métodos de la Cache API"],
    [
        ["Archivos base (HTML, CSS, JS, iconos)", "Precaching en install; luego network first con respaldo en caché",
         "caches.open(), cache.addAll(), cache.match(), cache.put()"],
        ["Navegación y recursos estáticos", "Network first con respaldo en caché", "cache.match(), cache.put()"],
        ["API pública de lectura (GET /api/zonas, /api/raites…)", "Network first; sin red se responde la última copia",
         "cache.put(), cache.match()"],
        ["API con datos personales o de escritura (/api/auth, /api/reservas, /api/admin, /api/push)", "Red directa: nunca se cachea",
         "—"],
        ["Versiones anteriores de la caché", "Borrado en activate", "caches.keys(), caches.delete()"],
    ],
)
blank()
body(
    "El nombre de la caché está versionado (rodando-utp-v3). Cuando se publican cambios se sube la versión; el "
    "evento activate localiza con caches.keys() las cachés anteriores y las elimina con caches.delete(). Así se "
    "evita que el usuario reciba archivos obsoletos y que el almacenamiento crezca sin control."
)

h2("4.3 Código del service worker")
body("Precaching de la aplicación en el evento install:")
codigo(
    "const CACHE = \"rodando-utp-v3\";\n"
    "const ARCHIVOS = [\"./\", \"./index.html\", \"./cache.html\", \"./css/styles.css\",\n"
    "                 \"./js/api.js\", \"./js/app.js\", \"./js/cache.js\", /* …iconos… */];\n"
    "\n"
    "self.addEventListener(\"install\", e => {\n"
    "  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));\n"
    "});"
)
body("Lecturas de la API pública con network first y respaldo en caché:")
codigo(
    "if (url.origin === self.location.origin && url.pathname.startsWith(\"/api/\")) {\n"
    "  if (API_PRIVADA.test(url.pathname)) return;         // datos personales: directo a la red\n"
    "  e.respondWith(\n"
    "    fetch(req)\n"
    "      .then(res => {\n"
    "        if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }\n"
    "        return res;\n"
    "      })\n"
    "      .catch(() => caches.match(req).then(r => r || new Response(  // sin red: última copia\n"
    "        JSON.stringify({ error: { code: \"SIN_CONEXION\", message: \"Sin conexión\" } }),\n"
    "        { status: 503, headers: { \"Content-Type\": \"application/json\" } })))\n"
    "  );\n"
    "  return;\n"
    "}"
)

h2("4.4 Laboratorio de caché")
body(
    "Para demostrar el uso de los métodos de la Cache API dentro de la aplicación se agregó la página cache.html, "
    "enlazada desde el menú principal con el nombre Caché. El laboratorio ejecuta las operaciones sobre las cachés "
    "reales del navegador y las registra en una bitácora en pantalla, de modo que cualquier persona puede "
    "comprobarlas sin abrir las herramientas de desarrollo:"
)
vineta("Sección 1: caches.keys(), caches.open(), caches.has() y caches.delete() sobre las cachés del origen.")
vineta("Sección 2: cache.keys() con la tabla de entradas (URL, tipo, tamaño) y, en cada fila, cache.match() y cache.delete().")
vineta("Sección 3: cache.add(), cache.addAll() con tres recursos, cache.put() con una Response propia, cache.match() y cache.matchAll().")
vineta("Sección 4: bitácora con la hora, el método, su argumento y el resultado de cada llamada.")
vineta("Sección 5: resumen de las estrategias de la Tabla 4 y la instrucción para probar el modo sin conexión.")
body(
    "La página incluye además un botón de demostración automática que ejecuta en orden caches.open(), cache.put(), "
    "cache.match(), cache.add(), cache.delete() y caches.has(), y muestra la cuota consumida con "
    "navigator.storage.estimate()."
)

h2("4.5 Verificación y resultados")
body(
    "La aplicación se probó en local con Chrome sobre el contenedor Docker del proyecto (HTTP en localhost, que el "
    "navegador considera contexto seguro). En la primera visita el service worker se instaló y precacheó 21 "
    "recursos; tras navegar por la aplicación, la caché pasó a 23 entradas, incluidas las respuestas de la API "
    "pública guardadas con cache.put(). La Figura 1 muestra la aplicación en marcha."
)

figura("01-home.png", "Figura 1. Página principal de Rodando UTP servida por la PWA; el service worker quedó activo y "
                      "precacheó los archivos base de la aplicación.")

body(
    "El laboratorio de caché confirmó el contenido de la caché creada por el service worker: caches.keys() listó "
    "rodando-utp-v3 y cache.keys() devolvió sus 21 entradas (Figura 2). La operación responde a la pregunta "
    "práctica de qué archivos quedaron disponibles sin conexión."
)
figura("02-lab.png", "Figura 2. Laboratorio de caché: caches.keys() y cache.keys() muestran la caché rodando-utp-v3 "
                      "del service worker con 21 entradas precacheadas.")

body(
    "La demostración automática ejecutó seis métodos distintos y registró cada resultado en la bitácora: "
    "caches.open() creó la caché lab-demo, cache.put() guardó una Response construida por la aplicación, "
    "cache.match() la recuperó con estado 200, cache.add() descargó un recurso real del sitio, cache.delete() "
    "borró una entrada y caches.has() confirmó la existencia de la caché (Figura 3)."
)
figura("03-lab-demo.png", "Figura 3. Bitácora de la demostración automática: apertura de caché, escritura con "
                          "cache.put(), lectura con cache.match(), descarga con cache.add(), borrado y comprobación.")

body(
    "Por último se cortó la red con las herramientas de desarrollo y se recargó el laboratorio. La página respondió "
    "desde la caché: el service worker siguió activo, la barra de aviso sin conexión apareció y las entradas "
    "aumentaron a 23 porque también se guardaron las respuestas de la API pública (Figura 4). Con esto queda "
    "comprobado el arranque sin conexión, que es el objetivo principal de la caché en una PWA."
)
figura("04-offline.png", "Figura 4. Recarga sin conexión: la aplicación responde desde Cache Storage (23 entradas) y "
                          "muestra el aviso de que se está usando la versión guardada.")

body(
    "Como comprobación complementaria del proyecto se ejecutaron las pruebas automatizadas del backend (39 pruebas, "
    "todas aprobadas) y el análisis estático con ESLint (sin errores), y se verificó la caché en memoria del "
    "servidor, que responde a la primera petición con la cabecera X-Cache: MISS y a la segunda con X-Cache: HIT."
)

h2("4.6 Caché del lado del servidor")
body(
    "Además de la caché del navegador, la API implementa una caché en memoria con tiempo de vida para las lecturas "
    "públicas. No es un requisito de una PWA, pero completa la explicación porque muestra las dos capas que "
    "intervienen: la caché del servidor evita repetir consultas a la base de datos y la del navegador evita "
    "repetir descargas y sostiene la aplicación sin conexión."
)
codigo(
    "$ curl -si localhost:3000/api/zonas | grep -i x-cache      # X-Cache: MISS\n"
    "$ curl -si localhost:3000/api/zonas | grep -i \"x-cache\\|age\"  # X-Cache: HIT, Age: 2"
)

# ══════════════════════════════════════════════════════════════════════════════
# 5. CONCLUSIONES
# ══════════════════════════════════════════════════════════════════════════════
doc.add_page_break()
h1("5. Conclusiones")
body(
    "La caché es lo que convierte una página web en una aplicación: permite abrirla sin conexión, responder al "
    "instante y reducir el consumo de datos. En una PWA ese control no se deja al navegador, sino que se programa "
    "con la Cache Storage API desde un service worker, que decide en cada petición si responde con la copia local "
    "o con la red."
)
body(
    "Los métodos de la API se agrupan de forma clara: caches.open(), caches.has(), caches.keys() y "
    "caches.delete() administran las cachés nombradas, mientras que add(), addAll(), put(), match(), matchAll(), "
    "delete() y keys() administran las entradas. Con ellos se construyen las estrategias cache first, network "
    "first y stale-while-revalidate, y se mantiene la caché ordenada con nombres versionados y limpieza en "
    "activate."
)
body(
    "La implementación en Rodando UTP muestra el ciclo completo: precaching de 21 archivos, respaldo de la API "
    "pública, exclusión explícita de los datos personales y las escrituras, y una página de laboratorio que ejecuta "
    "los métodos en vivo. Las evidencias confirman el resultado esperado: la aplicación y sus datos de lectura "
    "siguen disponibles con la red desconectada, la caché se actualiza al publicar una versión nueva y su contenido "
    "es inspeccionable tanto por el usuario como por las herramientas de desarrollo."
)

# ══════════════════════════════════════════════════════════════════════════════
# 6. REFERENCIAS
# ══════════════════════════════════════════════════════════════════════════════
h1("6. Referencias")
refs = [
    "MDN Web Docs. (2026). Cache. https://developer.mozilla.org/es/docs/Web/API/Cache",
    "MDN Web Docs. (2026). CacheStorage. https://developer.mozilla.org/es/docs/Web/API/CacheStorage",
    "MDN Web Docs. (2026). Service Worker API. https://developer.mozilla.org/es/docs/Web/API/Service_Worker_API",
    "MDN Web Docs. (2026). StorageManager.estimate(). https://developer.mozilla.org/es/docs/Web/API/StorageManager/estimate",
    "Osmani, A. (2021). The offline cookbook. web.dev. https://web.dev/articles/offline-cookbook",
    "Osmani, A., y Christiansen, J. (2021). Service workers: an introduction. web.dev. https://web.dev/articles/service-workers",
    "Whatwg. (2026). Service Workers. Living Standard. https://w3c.github.io/ServiceWorker/",
    "W3C. (2021). Web App Manifest. https://www.w3.org/TR/appmanifest/",
]
for r in refs:
    para = doc.add_paragraph()
    pf = para.paragraph_format
    pf.line_spacing = Pt(24)
    pf.left_indent = Cm(1.27)
    pf.first_line_indent = Cm(-1.27)
    run = para.add_run(r)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)

# ══════════════════════════════════════════════════════════════════════════════
# APÉNDICE
# ══════════════════════════════════════════════════════════════════════════════
doc.add_page_break()
h1("Apéndice A. Enlaces de la entrega")
body("Aplicación publicada (PWA): " + URL_APP)
body("Laboratorio de caché dentro de la aplicación: " + URL_APP.rstrip("/") + "/cache.html")
body("Código fuente (repositorio del proyecto): " + REPO)
body("Servicio de despliegue: Render (Web Service Docker) con base de datos PostgreSQL administrada.")

doc.save(str(SALIDA))
print("Documento generado:", SALIDA)
