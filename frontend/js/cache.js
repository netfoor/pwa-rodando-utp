/* =========================================================
   Rodando UTP · Laboratorio de caché (Cache Storage API)
   Ejecuta en vivo caches.open/has/keys/delete y
   cache.add/addAll/put/match/matchAll/delete/keys, y registra
   cada operación en la bitácora con su resultado.
   ========================================================= */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const SUPPORTED = "caches" in window;
let cacheSel = null;   // objeto Cache seleccionado
let nombreSel = null;  // su nombre

/* ---------------- Utilidades ---------------- */
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 2600);
}

function fmtBytes(n) {
  if (n == null) return "—";
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(2) + " MB";
}

function tipoDe(res) {
  if (!res) return "—";
  return (res.headers.get("content-type") || "sin tipo").split(";")[0];
}

/** Registra una operación en la bitácora (omite repetidas consecutivas). */
function log(metodo, argumento, ok, detalle) {
  const firma = `${metodo}|${argumento}|${ok}|${detalle}`;
  const primera = $("#log").firstElementChild;
  if (primera && primera.dataset.firma === firma) return; // evita duplicados exactos seguidos
  const fila = document.createElement("div");
  fila.className = "lab-log__row" + (ok ? "" : " lab-log__row--err");
  fila.dataset.firma = firma;
  const hora = new Date().toLocaleTimeString("es-MX", { hour12: false });
  fila.innerHTML =
    `<span class="lab-log__t">${hora}</span>` +
    `<code class="lab-log__m">${metodo}</code>` +
    `<span class="lab-log__a">${argumento || ""}</span>` +
    `<span class="lab-log__r">${ok ? "✓" : "✗"} ${detalle}</span>`;
  const caja = $("#log");
  caja.prepend(fila);
  while (caja.children.length > 60) caja.lastElementChild.remove();
}

/** Ejecuta una operación de caché y la registra siempre, incluso si falla. */
async function ejecutar(metodo, argumento, fn) {
  try {
    const r = await fn();
    log(metodo, argumento, true, resumen(metodo, r));
    return r;
  } catch (e) {
    log(metodo, argumento, false, e && e.message ? e.message : String(e));
    toast(`✗ ${metodo} falló`);
    return undefined;
  }
}

function resumen(metodo, r) {
  if (r === true) return "devolvió true";
  if (r === false) return "devolvió false";
  if (r === undefined) return "listo";
  if (Array.isArray(r)) return `${r.length} elemento${r.length === 1 ? "" : "s"}`;
  if (r && typeof r.status === "number") return `Response ${r.status} · ${tipoDe(r)}`;
  if (r && typeof r.name === "string") return `Cache «${r.name}»`;
  return "listo";
}

/* ---------------- Cachés (caches.*) ---------------- */
async function tamañoCache(nombre) {
  try {
    const c = await caches.open(nombre);
    const reqs = await c.keys();
    let total = 0;
    for (const req of reqs) {
      const res = await c.match(req);
      if (res) { const b = await res.clone().blob(); total += b.size; }
    }
    return { entradas: reqs.length, bytes: total };
  } catch { return { entradas: null, bytes: null }; }
}

async function listarCaches() {
  const caja = $("#cachesList");
  if (!SUPPORTED) { caja.innerHTML = "<p>Este navegador no soporta la Cache Storage API.</p>"; return; }

  const nombres = await caches.keys();           // caches.keys()
  log("caches.keys()", "", true, `${nombres.length} caché${nombres.length === 1 ? "" : "s"} en el navegador`);
  if (!nombres.length) {
    caja.innerHTML = `<p class="lab-hint lab-hint--soft">No hay cachés todavía.
      El service worker crea «rodando-utp-v4» al instalar la app; también puedes crear una con
      <code>caches.open()</code> arriba.</p>`;
    return;
  }

  const frag = document.createDocumentFragment();
  for (const nombre of nombres) {
    const { entradas, bytes } = await tamañoCache(nombre);
    const fila = document.createElement("div");
    fila.className = "lab-cache" + (nombre === nombreSel ? " lab-cache--on" : "");
    fila.innerHTML =
      `<div class="lab-cache__info">
         <b>${nombre}</b>
         <small>${entradas ?? "?"} entrada${entradas === 1 ? "" : "s"} · ${fmtBytes(bytes)}</small>
       </div>
       <div class="lab-cache__acts">
         <button class="btn btn--sm btn--primary" data-sel>Usar</button>
         <button class="btn btn--sm btn--danger" data-del>caches.delete()</button>
       </div>`;
    fila.querySelector("[data-sel]").addEventListener("click", () => seleccionar(nombre));
    fila.querySelector("[data-del]").addEventListener("click", async () => {
      const ok = await ejecutar("caches.delete()", nombre, () => caches.delete(nombre));  // caches.delete()
      if (ok) { toast(`Caché «${nombre}» borrada`); if (nombre === nombreSel) { cacheSel = null; nombreSel = null; pintarEntradas([]); $("#selName").textContent = "—"; } await listarCaches(); }
    });
    frag.appendChild(fila);
  }
  caja.replaceChildren(frag);
}

/** Selecciona la caché del service worker si el usuario no ha elegido otra. */
async function seleccionarPrincipal() {
  const nombres = await caches.keys();
  const principal = nombres.find(n => n.startsWith("rodando-utp")) || nombres[0];
  if (principal && !nombreSel) return seleccionar(principal);
  if (!principal) {
    $("#entriesEmpty").hidden = false;
    $("#entriesEmpty").textContent = "Aún no hay cachés: el service worker crea la principal al instalar la app. Si acabas de abrir la página, espera un momento.";
  }
}

/* ---------------- Entradas (cache.keys / match / delete) ---------------- */
async function seleccionar(nombre) {
  if (nombre === nombreSel && cacheSel) return;  // evitar trabajo repetido
  cacheSel = await caches.open(nombre);          // caches.open()
  nombreSel = nombre;
  $("#selName").textContent = nombre;
  log("caches.open()", nombre, true, `Cache «${nombre}» seleccionada`);
  await pintarEntradas(true);
  await listarCaches();
}

async function pintarEntradas(registrar = false) {
  const filas = $("#entriesRows");
  const vacio = $("#entriesEmpty");
  if (!cacheSel) {
    filas.replaceChildren();
    vacio.hidden = false;
    vacio.textContent = "Selecciona una caché con «Usar» para ver sus entradas.";
    return;
  }

  const reqs = await cacheSel.keys();            // cache.keys()
  if (registrar) log("cache.keys()", nombreSel, true, `${reqs.length} entrada${reqs.length === 1 ? "" : "s"} en «${nombreSel}»`);
  vacio.hidden = reqs.length > 0;
  if (!reqs.length) vacio.textContent = "La caché está vacía. Guarda algo en el paso 3.";

  const frag = document.createDocumentFragment();
  for (const req of reqs) {
    const res = await cacheSel.match(req);       // cache.match()
    const b = res ? await res.clone().blob() : null;
    const tr = document.createElement("tr");
    const urlCorta = req.url.replace(location.origin, "") || "/";
    tr.innerHTML =
      `<td data-l="URL"><span class="lab-url" title="${req.url}">${urlCorta}</span></td>` +
      `<td data-l="Tipo">${tipoDe(res)}</td>` +
      `<td data-l="Tamaño">${b ? fmtBytes(b.size) : "—"}</td>` +
      `<td class="acts lab-th-acts">
         <button class="btn btn--sm btn--outline" data-match>match()</button>
         <button class="btn btn--sm btn--danger" data-del>delete()</button>
       </td>`;
    tr.querySelector("[data-match]").addEventListener("click", () => probarMatch(req.url));
    tr.querySelector("[data-del]").addEventListener("click", async () => {
      const ok = await ejecutar("cache.delete()", urlCorta, () => cacheSel.delete(req));  // cache.delete()
      toast(ok ? "Entrada borrada" : "La entrada no existía");
      await pintarEntradas();
    });
    frag.appendChild(tr);
  }
  filas.replaceChildren(frag);
}

async function probarMatch(url) {
  const abs = new URL(url, location.href).href;
  const res = await ejecutar("cache.match()", abs, () => cacheSel ? cacheSel.match(abs) : Promise.reject(new Error("Selecciona una caché")));
  if (res) toast("✓ Recurso encontrado en la caché");
  else toast("✗ cache.match() devolvió undefined (miss)");
}

/* ---------------- Operaciones ---------------- */
function urlOp() {
  const v = $("#opUrl").value.trim() || "img/logo.svg";
  return new URL(v, location.href).href;
}

async function initOperaciones() {
  $("#btnAdd").addEventListener("click", async () => {
    if (!cacheSel) return toast("Selecciona una caché primero");
    const url = urlOp();
    const r = await ejecutar("cache.add()", url, () => cacheSel.add(url));  // cache.add()
    if (r !== undefined) toast("✓ Recurso guardado con cache.add()");
    await pintarEntradas();
  });

  $("#btnAddAll").addEventListener("click", async () => {
    if (!cacheSel) return toast("Selecciona una caché primero");
    const grupo = ["img/logo.svg", "img/paso-1.svg", "img/paso-2.svg"].map(u => new URL(u, location.href).href);
    const r = await ejecutar("cache.addAll()", "3 recursos", () => cacheSel.addAll(grupo));  // cache.addAll()
    if (r !== undefined) toast("✓ cache.addAll() completó los 3 recursos");
    await pintarEntradas();
  });

  $("#btnPut").addEventListener("click", async () => {
    if (!cacheSel) return toast("Selecciona una caché primero");
    const url = urlOp();
    // cache.put() guarda una Response construida aquí mismo (no depende de la red)
    const cuerpo = JSON.stringify({
      mensaje: "Respuesta guardada con cache.put()",
      url,
      cuando: new Date().toISOString()
    }, null, 2);
    const respuesta = new Response(cuerpo, { headers: { "Content-Type": "application/json" } });
    const r = await ejecutar("cache.put()", url, () => cacheSel.put(url, respuesta));
    if (r === undefined) toast("✓ Response propio guardado con cache.put()");
    await pintarEntradas();
  });

  $("#btnMatch").addEventListener("click", () => probarMatch($("#opUrl").value.trim() || "img/logo.svg"));

  $("#btnMatchAll").addEventListener("click", async () => {
    if (!cacheSel) return toast("Selecciona una caché primero");
    const url = urlOp();
    const r = await ejecutar("cache.matchAll()", url, () => cacheSel.matchAll(url, { ignoreSearch: true }));  // cache.matchAll()
    toast(r && r.length ? `✓ ${r.length} coincidencia(s)` : "✗ Sin coincidencias");
  });
}

/* ---------------- Encabezado: cachés globales ---------------- */
async function estadoCaches() {
  $("#btnOpen").addEventListener("click", async () => {
    const nombre = $("#cacheName").value.trim();
    if (!nombre) return toast("Escribe un nombre de caché");
    const c = await ejecutar("caches.open()", nombre, () => caches.open(nombre));  // caches.open()
    if (c) { toast(`Caché «${nombre}» lista`); await seleccionar(nombre); }
  });

  $("#btnHas").addEventListener("click", async () => {
    const nombre = $("#cacheName").value.trim();
    if (!nombre) return toast("Escribe un nombre de caché");
    const r = await ejecutar("caches.has()", nombre, () => caches.has(nombre));  // caches.has()
    toast(r === true ? `✓ Sí existe «${nombre}»` : `✗ No existe «${nombre}»`);
  });

  $("#btnDeleteCache").addEventListener("click", async () => {
    const nombre = $("#cacheName").value.trim();
    if (!nombre) return toast("Escribe un nombre de caché");
    const r = await ejecutar("caches.delete()", nombre, () => caches.delete(nombre));  // caches.delete()
    toast(r ? `✓ Caché «${nombre}» borrada` : `✗ No existía «${nombre}»`);
    if (nombre === nombreSel) { cacheSel = null; nombreSel = null; $("#selName").textContent = "—"; $("#entriesRows").innerHTML = ""; $("#entriesEmpty").hidden = false; }
    await listarCaches();
  });
}

/* ---------------- Cuota y service worker ---------------- */
async function cuota() {
  if (!navigator.storage?.estimate) { $("#quotaPill").textContent = "Cuota: no disponible"; return; }
  const { usage, quota } = await navigator.storage.estimate();
  $("#quotaPill").textContent = `Cuota: ${fmtBytes(usage)} usados de ~${fmtBytes(quota)}`;
}

function estadoSW() {
  if (!("serviceWorker" in navigator)) { $("#swPill").textContent = "Service Worker: no soportado"; return; }
  navigator.serviceWorker.getRegistration().then(reg => {
    const activo = reg && (reg.active || reg.installing || reg.waiting);
    $("#swPill").textContent = "Service Worker: " + (reg?.active ? "activo" : activo ? "instalando" : "sin registrar");
    $("#swPill").classList.toggle("on", !!reg?.active);
  }).catch(() => {});
}

/* ---------------- Barra sin conexión ---------------- */
function barraOffline() {
  const bar = $("#offlineBar");
  const upd = () => bar.classList.toggle("show", !navigator.onLine);
  addEventListener("online", upd);
  addEventListener("offline", upd);
  upd();
}

/* ---------------- Arranque ---------------- */
async function init() {
  if (!SUPPORTED) {
    $("#cachesList").innerHTML = "<p>Tu navegador no implementa la Cache Storage API.</p>";
    return;
  }
  barraOffline();
  // El laboratorio usa el mismo service worker del sitio: al registrarlo se
  // ejecuta caches.open() + cache.addAll() del precaching.
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").then(() => estadoSW()).catch(() => {});
    navigator.serviceWorker.ready
      .then(() => { estadoSW(); listarCaches().then(seleccionarPrincipal); })
      .catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      estadoSW(); listarCaches().then(seleccionarPrincipal);
    });
  }
  estadoSW();
  estadoCaches();
  initOperaciones();
  await cuota();
  await listarCaches();
  await seleccionarPrincipal();

  $("#btnReload").addEventListener("click", async () => { if (nombreSel) await seleccionar(nombreSel); await listarCaches(); });
  $("#refreshAll").addEventListener("click", async () => { await cuota(); await listarCaches(); if (nombreSel) await pintarEntradas(true); toast("Actualizado"); });
  $("#btnClearLog").addEventListener("click", () => { $("#log").innerHTML = ""; });
  $("#btnDemo").addEventListener("click", () => demo(false));

  log("Cache Storage API", "", true, "Laboratorio listo");

  // ?demo=1 ejecuta la secuencia sola (útil para capturas y para revisar la bitácora)
  if (new URLSearchParams(location.search).has("demo")) setTimeout(() => demo(true), 800);
}

/** Secuencia guiada: open → put → match → add → keys → delete → has.
 *  `rapido` acelera las pausas para ejecuciones automáticas/capturas. */
async function demo(rapido = false) {
  if (!SUPPORTED) return;
  log("demo()", "inicio", true, "secuencia guiada iniciada");
  const espera = ms => new Promise(r => setTimeout(r, rapido ? Math.min(ms, 60) : ms));
  $("#btnDemo").disabled = true;

  const nombre = "lab-demo";
  $("#cacheName").value = nombre;
  await ejecutar("caches.open()", nombre, () => caches.open(nombre));   // caches.open()
  await seleccionar(nombre);
  await espera(350);

  const url = new URL("img/paso-3.svg", location.href).href;
  const cuerpo = JSON.stringify({ mensaje: "Demo cache.put()", cuando: new Date().toISOString() }, null, 2);
  await ejecutar("cache.put()", url, () => cacheSel.put(url, new Response(cuerpo, {
    headers: { "Content-Type": "application/json" }
  })));
  await espera(350);

  await ejecutar("cache.match()", url, () => cacheSel.match(url));       // cache.match()
  await espera(350);

  const logo = new URL("img/logo.svg", location.href).href;
  await ejecutar("cache.add()", logo, () => cacheSel.add(logo));         // cache.add()
  await espera(350);

  await pintarEntradas();
  await espera(350);

  await ejecutar("cache.delete()", url, () => cacheSel.delete(url));     // cache.delete()
  await espera(350);

  await ejecutar("caches.has()", nombre, () => caches.has(nombre));      // caches.has()
  await cuota();
  await listarCaches();
  await pintarEntradas(true);
  toast("✓ Demostración completada");
  $("#btnDemo").disabled = false;
}
init();
