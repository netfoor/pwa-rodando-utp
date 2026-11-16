// Capturas de evidencia del Subproducto 7, tomadas sobre la aplicación publicada.
// uso: node capturar.mjs estaticas   (inicio, instalación, manifiesto, HTTPS, SW, caché, offline, Swagger)
//      node capturar.mjs vivo        (simula un viaje real en producción; correr de lunes a sábado)
// Requiere google-chrome. Las páginas de evidencia que se generan en _build/ solo
// muestran datos obtenidos en ese momento de producción o de la base local.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BASE = "https://rodando-utp-m12i.onrender.com";
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../..");
const OUT = join(AQUI, "img");
const BUILD = join(AQUI, "_build");
mkdirSync(OUT, { recursive: true });
mkdirSync(BUILD, { recursive: true });

const PORT = 9351;
const RAITE = 1; // Mariana López, ida 06:20: Zócalo → Paseo Bravo → Blvd. 5 de Mayo → UTP
const PARADA = "Paseo Bravo";
const CONDUCTOR = { correo: "mariana.lopez@utpuebla.edu.mx", password: "Demo1234!" };
const PASAJERO = { correo: "evidencia.backend@utpuebla.edu.mx", password: "Prueba1234" };
const UA_ESCRITORIO = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const dormir = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const fechaMx = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

async function api(ruta, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + ruta, {
    method,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const texto = await res.text();
  let datos;
  try { datos = JSON.parse(texto); } catch { datos = texto; }
  if (!res.ok) throw new Error(`${method} ${ruta} → ${res.status}: ${texto.slice(0, 300)}`);
  return datos;
}

/* ---------- Chrome por el protocolo de depuración ---------- */
let chrome, ws, seq = 0;
const pendientes = new Map();

async function lanzar() {
  const perfil = mkdtempSync(join(tmpdir(), "evidencia-"));
  chrome = spawn("google-chrome", [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--hide-scrollbars",
    "--force-color-profile=srgb", "--allow-file-access-from-files",
    `--user-data-dir=${perfil}`, `--remote-debugging-port=${PORT}`, "about:blank"
  ], { stdio: "ignore" });
  let url;
  for (let i = 0; i < 150 && !url; i++) {
    try { url = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
    catch { await dormir(200); }
  }
  if (!url) throw new Error("Chrome no abrió el puerto de depuración");
  ws = new WebSocket(url);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
  });
  return perfil;
}

const cdp = (method, params = {}, sessionId) => new Promise((ok, mal) => {
  const id = ++seq;
  pendientes.set(id, m => m.error ? mal(new Error(`${method}: ${m.error.message}`)) : ok(m.result));
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

/** Abre una pestaña en un contexto aislado (cookies, caché y service worker propios). */
async function pestana({ ancho = 1440, alto = 900, movil = false, ua = UA_ESCRITORIO, sesion, comoSafari = false } = {}) {
  const { browserContextId } = await cdp("Target.createBrowserContext", {});
  const { targetId } = await cdp("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => cdp(m, p, sessionId);
  await S("Page.enable");
  await S("Page.bringToFront");
  await S("Runtime.enable");
  await S("Network.enable");
  await S("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: movil ? 2 : 1, mobile: movil });
  await S("Emulation.setUserAgentOverride", { userAgent: ua, acceptLanguage: "es-MX,es" });
  // Safari en iOS no emite beforeinstallprompt; Chrome sin interfaz sí, aunque se identifique como iPhone
  if (comoSafari) await S("Page.addScriptToEvaluateOnNewDocument", {
    source: `addEventListener("beforeinstallprompt", e => e.stopImmediatePropagation(), true);` });
  if (sesion) {
    await S("Page.addScriptToEvaluateOnNewDocument", { source: `
      if (!localStorage.getItem("ru-token")) {
        localStorage.setItem("ru-token", ${JSON.stringify(sesion.token)});
        localStorage.setItem("ru-user", ${JSON.stringify(JSON.stringify(sesion.usuario))});
      }` });
  }
  const cerrar = async () => {
    await cdp("Target.closeTarget", { targetId }).catch(() => {});
    await cdp("Target.disposeBrowserContext", { browserContextId }).catch(() => {});
  };
  return { S, cerrar };
}

async function evaluar(S, expression) {
  const r = await S("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}

/** Clic real con el ratón (un click() sintético no siempre dispara el flujo de instalación). */
async function clic(S, selector) {
  const [x, y] = await evaluar(S, `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  for (const type of ["mousePressed", "mouseReleased"]) await S("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
}

async function ir(S, url, espera = 3500) {
  await S("Page.navigate", { url });
  await dormir(espera);
}

async function esperar(S, condicion, ms = 15000) {
  for (let t = 0; t < ms; t += 300) {
    if (await evaluar(S, condicion).catch(() => false)) return true;
    await dormir(300);
  }
  return false;
}

async function capturar(S, archivo, { selector, completa = false } = {}) {
  await S("Page.bringToFront"); // una pestaña en segundo plano no entrega cuadros y la captura se queda esperando
  const p = { format: "png", captureBeyondViewport: completa || Boolean(selector) };
  if (selector) {
    const c = await evaluar(S, `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })()`);
    p.clip = { ...c, scale: 1 };
  }
  const { data } = await S("Page.captureScreenshot", p);
  writeFileSync(join(OUT, archivo), Buffer.from(data, "base64"));
  console.log("imagen:", archivo);
}

/** Página de evidencia con el mismo estilo para todas (datos obtenidos al momento). */
function pagina(nombre, titulo, subtitulo, cuerpo) {
  const ruta = join(BUILD, nombre);
  writeFileSync(ruta, `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  body{margin:0;background:#f4f3f1;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif}
  .wrap{max-width:1180px;margin:34px auto;padding:0 30px}
  h1{font-size:26px;margin:0 0 6px} .sub{color:#555;margin:0 0 20px;font-size:14px}
  .card{background:#fff;border:1px solid #d8d6d2;border-radius:12px;padding:18px 20px;margin-bottom:16px}
  table{border-collapse:collapse;width:100%;font-size:13px}
  th{text-align:left;border-bottom:2px solid #1a1a1a;padding:7px 8px}
  td{padding:7px 8px;border-bottom:1px solid #e6e3df;vertical-align:top}
  .mono,td.mono,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px}
  pre{margin:0;white-space:pre-wrap;line-height:1.5}
  .grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}
  .icons{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;text-align:center}
  .icons img{height:110px;display:block;margin:0 auto 8px} .icons span{font-size:12px;color:#555}
  b.ok{color:#0a6b45}
  </style></head><body><div class="wrap"><h1>${esc(titulo)}</h1><p class="sub">${subtitulo}</p>${cuerpo}</div></body></html>`);
  return pathToFileURL(ruta).href;
}

async function capturarPagina(url, archivo, alto = 900) {
  const { S, cerrar } = await pestana({ ancho: 1240, alto });
  try {
    await ir(S, url, 1200);
    await capturar(S, archivo, { selector: ".wrap" });
  } finally { await cerrar(); }
}

/* ---------- Capturas que no dependen del día ---------- */
async function estaticas() {
  const pasajero = await api("/api/auth/login", { method: "POST", body: PASAJERO });

  // 1 y 2: inicio en escritorio y en móvil
  {
    const { S, cerrar } = await pestana({ ancho: 1440, alto: 900 });
    await ir(S, BASE + "/", 4500);
    await capturar(S, "01-inicio-escritorio.png");
    await cerrar();
  }
  {
    const { S, cerrar } = await pestana({ ancho: 390, alto: 844, movil: true, ua: UA_ANDROID });
    await ir(S, BASE + "/", 4500);
    const ancho = await evaluar(S, "[document.documentElement.scrollWidth, innerWidth]");
    console.log("ancho móvil (documento, ventana):", ancho);
    await capturar(S, "02-inicio-movil.png");
    await cerrar();
  }

  // 3: instalación en iPhone (sin beforeinstallprompt se muestran las instrucciones)
  {
    const { S, cerrar } = await pestana({ ancho: 390, alto: 844, movil: true, ua: UA_IOS, comoSafari: true });
    await ir(S, BASE + "/", 4500);
    await clic(S, "#installBtn");
    await esperar(S, `!document.querySelector("#modal").hidden`);
    await dormir(500);
    await capturar(S, "03-instalacion-ios.png");
    await cerrar();
  }

  // 4: manifiesto e iconos (los iconos se incrustan desde el repo: la API exige mismo origen)
  {
    const manifest = await api("/manifest.json");
    const icono = (archivo, etiqueta) => {
      const b64 = readFileSync(join(RAIZ, "frontend/img/icons", archivo)).toString("base64");
      return `<div><img src="data:image/png;base64,${b64}" alt=""><span>${etiqueta}</span></div>`;
    };
    const url = pagina("evidencia-manifest.html", "Manifiesto e iconos de la PWA",
      `GET ${BASE}/manifest.json · ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`,
      `<div class="grid"><div class="card"><pre>${esc(JSON.stringify({ ...manifest, shortcuts: `[${manifest.shortcuts.length} accesos directos]` }, null, 2))}</pre></div>
       <div class="card"><div class="icons">${icono("icon-192.png", "icon-192.png · 192×192 · any")}${icono("icon-512.png", "icon-512.png · 512×512 · any")}
       ${icono("icon-maskable-512.png", "icon-maskable-512.png · maskable")}${icono("apple-touch-icon-180.png", "apple-touch-icon-180.png · iOS")}</div></div></div>`);
    await capturarPagina(url, "04-manifest-iconos.png", 1300);
  }

  // 5: cabeceras HTTPS de producción
  {
    const res = await fetch(BASE + "/");
    const filas = [...res.headers.entries()]
      .filter(([k]) => !["cf-ray", "rndr-id", "date", "etag", "last-modified", "alt-svc", "nel", "report-to", "server-timing"].includes(k))
      .map(([k, v]) => `<tr><td class="mono">${k}</td><td class="mono">${esc(v)}</td></tr>`).join("");
    const url = pagina("evidencia-https.html", "Respuesta HTTPS de producción",
      `GET ${BASE}/ · HTTP ${res.status} · ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`,
      `<div class="card"><table>${filas}</table></div>`);
    await capturarPagina(url, "05-https.png");
  }

  // 6: registro del service worker y cachés creadas (datos leídos del navegador)
  {
    const { S, cerrar } = await pestana({ ancho: 1440, alto: 900 });
    await ir(S, BASE + "/", 3000);
    await esperar(S, "navigator.serviceWorker.ready.then(() => true)");
    await ir(S, BASE + "/", 3500); // segunda carga: la página ya queda controlada
    const info = await evaluar(S, `(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const caches_ = await caches.keys();
      const detalle = await Promise.all(caches_.map(async n => [n, (await (await caches.open(n)).keys()).length]));
      return { scope: reg.scope, script: reg.active?.scriptURL, estado: reg.active?.state,
        controla: Boolean(navigator.serviceWorker.controller), caches: detalle, seguro: isSecureContext };
    })()`);
    await cerrar();
    const url = pagina("evidencia-sw.html", "Service worker registrado en producción",
      `navigator.serviceWorker.getRegistration() y caches.keys() en ${BASE}/`,
      `<div class="card"><table>
        <tr><td>Contexto seguro (isSecureContext)</td><td class="mono"><b class="ok">${info.seguro}</b></td></tr>
        <tr><td>Script</td><td class="mono">${esc(info.script)}</td></tr>
        <tr><td>Ámbito (scope)</td><td class="mono">${esc(info.scope)}</td></tr>
        <tr><td>Estado del worker activo</td><td class="mono"><b class="ok">${esc(info.estado)}</b></td></tr>
        <tr><td>¿Controla la página?</td><td class="mono"><b class="ok">${info.controla}</b></td></tr>
        ${info.caches.map(([n, c]) => `<tr><td>Caché</td><td class="mono">${esc(n)} · ${c} entradas</td></tr>`).join("")}
      </table></div>`);
    await capturarPagina(url, "06-service-worker.png", 600);
  }

  // 7: laboratorio de la Cache API con la demostración automática
  {
    const { S, cerrar } = await pestana({ ancho: 1440, alto: 1100 });
    await ir(S, BASE + "/cache.html?demo=1", 9000);
    await evaluar(S, `document.querySelector("#t4")?.closest("section")?.scrollIntoView({ block: "center" })`);
    await dormir(800);
    await capturar(S, "07-cache-api.png");
    await cerrar();
  }

  // 8: sin conexión, con la sesión conservada
  {
    const { S, cerrar } = await pestana({ ancho: 1440, alto: 900, sesion: pasajero });
    await ir(S, BASE + "/", 3500);
    await esperar(S, "navigator.serviceWorker.ready.then(() => true)");
    await ir(S, BASE + "/", 4000);
    await S("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await ir(S, BASE + "/", 4500);
    const estado = await evaluar(S, `({ online: navigator.onLine, cuenta: document.querySelector("#accountLabel")?.textContent,
      barra: document.querySelector("#offlineBar")?.classList.contains("show"), raites: document.querySelectorAll("#rides .ride, #rides article").length })`);
    console.log("sin conexión:", estado);
    await evaluar(S, `document.querySelector("#rutas")?.scrollIntoView()`);
    await dormir(1200);
    await capturar(S, "08-sin-conexion.png");
    await cerrar();
  }

  // 10: Swagger con las rutas del seguimiento en vivo
  {
    const { S, cerrar } = await pestana({ ancho: 1440, alto: 1000 });
    await ir(S, BASE + "/api/docs", 5000);
    await evaluar(S, `(() => { const t = [...document.querySelectorAll("h3, .opblock-tag")].find(e => /vivo/i.test(e.textContent));
      t?.scrollIntoView(); scrollBy(0, -10); return Boolean(t); })()`);
    await dormir(1000);
    await capturar(S, "10-swagger-vivo.png");
    await cerrar();
  }
}

/* ---------- Viaje real en producción (lunes a sábado) ---------- */
async function vivo() {
  const fecha = fechaMx();
  const conductor = await api("/api/auth/login", { method: "POST", body: CONDUCTOR });
  const pasajero = await api("/api/auth/login", { method: "POST", body: PASAJERO });

  let estado = await api(`/api/vivo/${RAITE}?fecha=${fecha}`, { token: pasajero.token });
  if (!estado.raite.dias.includes(estado.dia)) throw new Error(`El raite ${RAITE} no sale el ${fecha}`);
  await api(`/api/vivo/${RAITE}/iniciar`, { method: "POST", token: conductor.token, body: { fecha } });
  if (!estado.miReserva) {
    const s = await api(`/api/vivo/${RAITE}/solicitar`, { method: "POST", token: pasajero.token, body: { parada: PARADA, fecha } });
    await api(`/api/vivo/${RAITE}/solicitudes/${s.codigo}/aceptar`, { method: "POST", token: conductor.token, body: { fecha } });
  }
  estado = await api(`/api/vivo/${RAITE}?fecha=${fecha}`, { token: conductor.token });

  // Posiciones sobre el trazo real hasta quedar a 3 minutos o menos de la parada del pasajero
  const ruta = estado.ruta;
  const R = 6371000, rad = Math.PI / 180;
  const dist = ([a1, o1], [a2, o2]) => {
    const h = Math.sin((a2 - a1) * rad / 2) ** 2 + Math.cos(a1 * rad) * Math.cos(a2 * rad) * Math.sin((o2 - o1) * rad / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const acum = [0];
  for (let i = 1; i < ruta.length; i++) acum.push(acum[i - 1] + dist(ruta[i - 1], ruta[i]));
  const punto = s => {
    for (let i = 1; i < ruta.length; i++) if (acum[i] >= s) {
      const t = (s - acum[i - 1]) / ((acum[i] - acum[i - 1]) || 1);
      return [ruta[i - 1][0] + (ruta[i][0] - ruta[i - 1][0]) * t, ruta[i - 1][1] + (ruta[i][1] - ruta[i - 1][1]) * t];
    }
    return ruta.at(-1);
  };
  const total = acum.at(-1);
  const orden = estado.raite.tipo === "ida" ? estado.raite.paradas : [...estado.raite.paradas].reverse();
  const destino = total * (orden.indexOf(PARADA) + 1) / (orden.length + 1);
  const mandar = async s => {
    const [lat, lng] = punto(Math.max(0, s));
    return api(`/api/vivo/${RAITE}/posicion`, { method: "POST", token: conductor.token,
      body: { lat, lng, precision: 6, velocidad: 8.3, rumbo: 0, fecha } });
  };
  let s = destino - 2600, r;
  for (; s < destino - 400; s += 300) {
    r = await mandar(s);
    if (r.posicion?.etaMin != null && r.posicion.etaMin <= 3) break;
    await dormir(400);
  }
  console.log("posición enviada:", r.posicion);

  // 9: vista del pasajero con el auto en el mapa
  {
    const { S, cerrar } = await pestana({ ancho: 1440, alto: 1000, sesion: pasajero });
    await ir(S, `${BASE}/vivo.html?raite=${RAITE}`, 3000);
    await mandar(s);
    await esperar(S, `document.querySelectorAll(".leaflet-tile-loaded").length >= 6 && !!document.querySelector(".car-pin, .leaflet-marker-icon")`, 20000);
    await dormir(1500);
    await capturar(S, "09-vivo-pasajero.png");
    await cerrar();
  }
  // 12: panel del conductor (misma sesión de viaje, otra cuenta)
  {
    const { S, cerrar } = await pestana({ ancho: 1440, alto: 1000, sesion: conductor });
    await ir(S, `${BASE}/vivo.html?raite=${RAITE}`, 3000);
    await mandar(s + 60);
    await esperar(S, `document.querySelectorAll(".leaflet-tile-loaded").length >= 6`, 20000);
    await dormir(1500);
    await capturar(S, "12-vivo-conductor.png");
    await cerrar();
  }

  await api(`/api/vivo/${RAITE}/avisar`, { method: "POST", token: pasajero.token, body: { fecha } });
  await api(`/api/vivo/${RAITE}/finalizar`, { method: "POST", token: conductor.token, body: { fecha } });
  // Devolver el asiento: la reserva de evidencia no debe quedarse ocupando un lugar real
  const mia = (await api(`/api/vivo/${RAITE}?fecha=${fecha}`, { token: pasajero.token })).miReserva;
  if (mia?.codigo) await api(`/api/reservas/${mia.codigo}`, { method: "DELETE", token: pasajero.token });
  const { notificaciones } = await api(`/api/vivo/${RAITE}/notificaciones?fecha=${fecha}`, { token: conductor.token });
  writeFileSync(join(BUILD, "bitacora.json"), JSON.stringify({ fecha, notificaciones }, null, 2));
  const filas = notificaciones.map(n => `<tr><td>${n.id}</td><td><b>${esc(n.tipo)}</b></td><td>${esc(n.parada || "—")}</td>
    <td>${esc(n.resultado)}</td><td>${esc(n.detalle || "—")}</td>
    <td>${new Date(n.enviadoEn).toLocaleString("es-MX", { timeZone: "America/Mexico_City", hour12: false })}</td></tr>`).join("");
  const url = pagina("evidencia-bitacora.html", "Bitácora de avisos push del viaje",
    `<span class="mono">GET /api/vivo/${RAITE}/notificaciones?fecha=${fecha}</span> · consultada con la sesión de la conductora`,
    `<div class="card"><table><tr><th>ID</th><th>Tipo</th><th>Parada</th><th>Resultado</th><th>Detalle</th><th>Registrado</th></tr>${filas}</table></div>`);
  await capturarPagina(url, "11-bitacora.png", 700);
}

/* ---------- Pruebas automatizadas y esquema de la base local ---------- */
async function pruebas() {
  const back = join(RAIZ, "backend");
  const correr = (cmd, args) => {
    try { return execFileSync(cmd, args, { cwd: back, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" } }); }
    catch (e) { return (e.stdout || "") + (e.stderr || ""); }
  };
  const test = correr("npx", ["vitest", "run", "--reporter=verbose"])
    .split("\n").filter(l => /✓|×|Test Files|Tests |Duration/.test(l)).join("\n");
  const lint = correr("npx", ["eslint", "."]).trim() || "sin errores ni advertencias";
  const url = pagina("evidencia-pruebas.html", "Pruebas automatizadas del backend",
    "npx vitest run --reporter=verbose y npx eslint . sobre PostgreSQL 16 de pruebas",
    `<div class="card"><pre>${esc(test)}</pre></div><div class="card"><pre>eslint: ${esc(lint)}</pre></div>`);
  await capturarPagina(url, "13-pruebas.png", 1400);

  const sql = `SELECT table_name, string_agg(column_name, ', ' ORDER BY ordinal_position)
    FROM information_schema.columns WHERE table_schema='public' AND table_name IN
    ('users','raites','reservas','viajes','push_subscriptions','notificaciones_log','schema_migrations')
    GROUP BY table_name ORDER BY table_name;`;
  const esquema = execFileSync("docker", ["exec", "pg-test", "psql", "-U", "rodando", "-d", "rodando_preview", "-At", "-F", "\t", "-c", sql], { encoding: "utf8" });
  const migraciones = execFileSync("docker", ["exec", "pg-test", "psql", "-U", "rodando", "-d", "rodando_preview", "-At", "-c",
    "SELECT name || '  ' || to_char(applied_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') FROM schema_migrations ORDER BY name"], { encoding: "utf8" });
  const filas = esquema.trim().split("\n").map(l => l.split("\t")).map(([t, c]) => `<tr><td class="mono"><b>${t}</b></td><td class="mono">${esc(c)}</td></tr>`).join("");
  const url2 = pagina("evidencia-bd.html", "Esquema de PostgreSQL del seguimiento en vivo",
    "information_schema.columns en una base local creada con las mismas migraciones que producción",
    `<div class="card"><table><tr><th>Tabla</th><th>Columnas</th></tr>${filas}</table></div>
     <div class="card"><pre>schema_migrations\n${esc(migraciones.trim())}</pre></div>`);
  await capturarPagina(url2, "14-base-de-datos.png", 900);
}

const modo = process.argv[2];
async function instalacion() {
  const { S, cerrar } = await pestana({ ancho: 390, alto: 844, movil: true, ua: UA_IOS, comoSafari: true });
  await ir(S, BASE + "/", 4500);
  await clic(S, "#installBtn");
  if (!await esperar(S, `!document.querySelector("#modal").hidden`)) throw new Error("No se abrió la ventana de instalación");
  await dormir(500); // la animación de entrada dura 0.3 s
  await capturar(S, "03-instalacion-ios.png");
  await cerrar();
}

/** Bitácora de un viaje ya registrado en producción (consulta de solo lectura). */
async function bitacora(raite = 2, fecha = "2026-11-16") {
  const conductor = await api("/api/auth/login", { method: "POST", body: CONDUCTOR });
  const { notificaciones } = await api(`/api/vivo/${raite}/notificaciones?fecha=${fecha}`, { token: conductor.token });
  const filas = notificaciones.map(n => `<tr><td>${n.id}</td><td><b>${esc(n.tipo)}</b></td><td>${esc(n.parada || "—")}</td>
    <td>${esc(n.resultado)}</td><td>${esc(n.detalle || "—")}</td>
    <td>${new Date(n.enviadoEn).toLocaleString("es-MX", { timeZone: "America/Mexico_City", hour12: false })}</td></tr>`).join("");
  const url = pagina("evidencia-bitacora.html", "Bitácora de avisos push del viaje",
    `<span class="mono">GET ${BASE}/api/vivo/${raite}/notificaciones?fecha=${fecha}</span> · consultada con la sesión de la conductora`,
    `<div class="card"><table><tr><th>ID</th><th>Tipo</th><th>Parada</th><th>Resultado</th><th>Detalle</th><th>Registrado</th></tr>${filas}</table></div>`);
  await capturarPagina(url, "11-bitacora.png", 700);
}

const tareas = { estaticas, vivo, pruebas, instalacion, bitacora: () => bitacora() };
if (!tareas[modo]) { console.error("uso: node capturar.mjs estaticas|vivo|pruebas"); process.exit(1); }
const perfil = await lanzar();
try { await tareas[modo](); }
finally {
  chrome.kill("SIGKILL");
  setTimeout(() => rmSync(perfil, { recursive: true, force: true }), 500);
}
