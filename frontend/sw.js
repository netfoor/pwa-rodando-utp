/* =========================================================
   Rodando UTP · Service Worker
   Red primero y caché de respaldo: siempre muestra lo más
   nuevo, pero funciona sin internet.
   - /api/*: red primero; si falla, la última copia guardada
     (solo peticiones GET públicas; la sesión nunca se cachea).
   - Notificaciones push: muestra el aviso y abre #rutas.
   (Sube la versión al cambiar archivos.)
   ========================================================= */
const CACHE = "rodando-utp-v3";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./cache.html",
  "./css/styles.css",
  "./js/api.js",
  "./js/app.js",
  "./js/cache.js",
  "./js/panel.js",
  "./js/admin.js",
  "./admin.html",
  "./panel.html",
  "./manifest.json",
  "./img/logo.svg",
  "./img/hero.svg",
  "./img/paso-1.svg",
  "./img/paso-2.svg",
  "./img/paso-3.svg",
  "./img/conductor.svg",
  "./img/icons/icon-192.png",
  "./img/icons/icon-512.png",
  "./video/poster.png"
];

// Endpoints con datos personales o de escritura: nunca se guardan en caché.
const API_PRIVADA = /^\/api\/(auth|reservas|admin|push)\b/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return; // el video se transmite por rangos
  const url = new URL(req.url);

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    if (API_PRIVADA.test(url.pathname) || url.pathname.startsWith("/api/docs")) return; // directo a la red
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || new Response(
          JSON.stringify({ error: { code: "SIN_CONEXION", message: "Sin conexión" } }),
          { status: 503, headers: { "Content-Type": "application/json" } })))
    );
    return;
  }

  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then(res => {
        if (res.ok && (req.url.startsWith(self.location.origin) || req.url.includes("fonts.g"))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});

/* ---------- Notificaciones push ---------- */
self.addEventListener("push", e => {
  let datos = { titulo: "Rodando UTP", mensaje: "Tienes una novedad en tus raites.", url: "/#rutas" };
  try { datos = { ...datos, ...e.data.json() }; } catch { /* payload vacío o de texto */ }
  e.waitUntil(self.registration.showNotification(datos.titulo, {
    body: datos.mensaje,
    icon: "./img/icons/icon-192.png",
    badge: "./img/icons/icon-192.png",
    data: { url: datos.url }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(wins => {
      const abierta = wins.find(w => "focus" in w);
      if (abierta) { abierta.postMessage({ irA: "#rutas" }); return abierta.focus(); }
      return self.clients.openWindow("./index.html#rutas");
    })
  );
});
