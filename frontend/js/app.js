/* =========================================================
   Rodando UTP · Lógica de la página
   Los datos vienen de la API (js/api.js); no hay datos
   de ejemplo en el cliente.
   ========================================================= */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const money = n => "$" + Math.round(n).toLocaleString("es-MX");
const turnoDe = hora => (parseInt(hora) < 12 ? "matutino" : "vespertino");
// Escapa texto de usuarios antes de insertarlo en HTML
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = nombre => esc(nombre.split(" ").map(p => p[0]).slice(0, 2).join(""));

// Catálogos que llegan de la API
let ZONAS = [];
let TESTIMONIOS = [];
let CONFIG = { precioGasolina: 24.3, co2PorLitro: 2.31, tarifaUberKm: 9.5, tarifaUberBase: 35, pasajeTransporte: 12 };
const UTP = { nombre: "UTP", x: 440, y: 140 };        // destino fijo en el mapa
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const zonaById = id => ZONAS.find(z => z.id === id) || { id, nombre: id, km: 0, color: "#8A97A8", x: 0, y: 0 };

// LocalStorage seguro (puede fallar en modo privado)
const store = {
  get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
};

/* ---------------- Tema claro / oscuro ---------------- */
const root = document.documentElement;
const savedTheme = store.get("ru-theme", null);
if (savedTheme) root.dataset.theme = savedTheme;
else if (matchMedia("(prefers-color-scheme: dark)").matches) root.dataset.theme = "dark";

$("#themeBtn").addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  store.set("ru-theme", next);
});

/* ---------------- Encabezado y navegación ---------------- */
const header = $("#header");
const nav = $("#nav");
const burger = $("#burger");

burger.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  burger.setAttribute("aria-expanded", open);
});
$$(".nav__link").forEach(a => a.addEventListener("click", () => {
  nav.classList.remove("open");
  burger.setAttribute("aria-expanded", false);
}));

// Resalta el enlace de la sección visible (scrollspy)
const navLinks = $$(".nav__link:not(.nav__link--ext)"); // el enlace al panel no es una sección
const spySections = navLinks.map(a => $(a.getAttribute("href")));
function onScroll() {
  const y = scrollY;
  header.classList.toggle("scrolled", y > 10);
  $("#toTop").classList.toggle("show", y > 700);

  let current = spySections[0];
  for (const s of spySections) if (s && s.offsetTop - 140 <= y) current = s;
  // Al final de la página, marcar la última sección
  if (innerHeight + y >= document.body.scrollHeight - 4) current = spySections[spySections.length - 1];
  navLinks.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + current.id));
}
addEventListener("scroll", onScroll, { passive: true });
$("#toTop").addEventListener("click", () => scrollTo({ top: 0 }));

/* ---------------- Animaciones al hacer scroll ---------------- */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("visible"); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.12 });
$$(".reveal").forEach(el => revealObs.observe(el));

// Contadores animados del hero (se observan cuando ya llegaron las cifras de la API)
const countObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, target = +el.dataset.count, suffix = el.dataset.suffix || "";
    const t0 = performance.now();
    const tick = t => {
      const p = Math.min((t - t0) / 1600, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("es-MX") + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    countObs.unobserve(el);
  });
});
async function initStats() {
  try {
    const s = await API.stats();
    const [est, cond, co2] = $$("[data-count]");
    est.dataset.count = s.estudiantes;
    cond.dataset.count = s.conductores;
    co2.dataset.count = Math.round(s.co2Toneladas);
  } catch { /* se quedan las cifras por defecto del HTML */ }
  $$("[data-count]").forEach(el => countObs.observe(el));
}

// Texto que rota en el título
const palabras = ["a clase", "al examen", "a la estadía", "temprano", "seguro"];
let iPalabra = 0;
setInterval(() => {
  const r = $("#rotator");
  iPalabra = (iPalabra + 1) % palabras.length;
  r.animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-12px)" }], { duration: 200 })
    .onfinish = () => {
      r.textContent = palabras[iPalabra];
      r.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 250 });
    };
}, 2600);

/* ---------------- Llenar selects de zonas ---------------- */
function fillZonas(sel, conTodas) {
  const valor = sel.value;
  sel.innerHTML = (conTodas ? `<option value="todas">Todas las zonas</option>` : "") +
    ZONAS.map(z => `<option value="${esc(z.id)}">${esc(z.nombre)} · ${z.km} km</option>`).join("");
  if (valor && [...sel.options].some(o => o.value === valor)) sel.value = valor;
}
function fillAllZonas() {
  fillZonas($("#heroZona"), true);
  fillZonas($("#fZona"), true);
  fillZonas($("#cZona"), false);
  fillZonas($("#dZona"), false);
}

/* ---------------- MAPA ---------------- */
const map = $("#map");
const NS = "http://www.w3.org/2000/svg";
let selectedRide = null;

function buildMap() {
  // Fondo: manzanas, calles y parques (decorativo)
  let bg = `<rect class="m-bg" width="600" height="420" rx="18"/>`;
  const rnd = mulberry(7);
  for (let x = 10; x < 600; x += 58) {
    for (let y = 10; y < 420; y += 50) {
      if (rnd() > 0.82) bg += `<rect class="m-park" x="${x}" y="${y}" width="50" height="42" rx="8"/>`;
      else bg += `<rect class="m-block" x="${x}" y="${y}" width="50" height="42" rx="6"/>`;
    }
  }
  bg += `<path class="m-street" d="M0 200 C 150 190, 300 150, 600 120"/>
         <path class="m-street" d="M200 0 C 230 150, 260 280, 240 420"/>
         <path class="m-street" d="M0 330 C 200 300, 420 330, 600 260" />
         <path class="m-street" d="M600 30 C 480 120, 420 300, 470 420"/>`;
  map.innerHTML = bg;

  // Rutas
  ZONAS.forEach(z => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", z.trazo);
    p.setAttribute("class", "m-route");
    p.setAttribute("stroke", z.color);
    p.dataset.zona = z.id;
    p.addEventListener("click", () => selectZona(z.id));
    map.appendChild(p);
  });

  // Coche que recorre la ruta seleccionada
  const car = document.createElementNS(NS, "g");
  car.setAttribute("class", "m-car");
  car.setAttribute("opacity", "0");
  car.innerHTML = `<circle r="15" fill="#7C3AED" stroke="#1E1B4B" stroke-width="3"/>
    <text y="5" text-anchor="middle" font-size="15">🚗</text>`;
  map.appendChild(car);

  // Nodos de zonas
  ZONAS.forEach(z => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "m-node");
    const anchor = z.x > 480 ? "end" : z.x < 120 ? "start" : "middle";
    const ty = z.y > 300 ? 28 : -16;
    g.innerHTML = `<circle cx="${z.x}" cy="${z.y}" r="9" fill="${esc(z.color)}"/>
      <text x="${z.x}" y="${z.y + ty}" text-anchor="${anchor}">${esc(z.nombre)}</text>`;
    g.addEventListener("click", () => selectZona(z.id));
    map.appendChild(g);
  });

  // Destino: UTP
  const utp = document.createElementNS(NS, "g");
  utp.setAttribute("class", "m-utp");
  utp.innerHTML = `<rect x="${UTP.x - 36}" y="${UTP.y - 20}" width="72" height="40" rx="12"/>
    <text x="${UTP.x}" y="${UTP.y + 5}" text-anchor="middle">🎓 UTP</text>`;
  map.appendChild(utp);

  // Leyenda
  $("#mapLegend").innerHTML = ZONAS.map(z =>
    `<button class="legend-chip" data-zona="${esc(z.id)}"><i style="background:${esc(z.color)}"></i>${esc(z.nombre)}</button>`).join("");
  $$(".legend-chip").forEach(b => b.addEventListener("click", () => selectZona(b.dataset.zona)));
}

// Generador pseudoaleatorio con semilla (el mapa siempre sale igual)
function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

let carAnim = null;
function highlightRoute(zonaId, reverse = false) {
  $$(".m-route", map).forEach(p => p.classList.toggle("on", p.dataset.zona === zonaId));
  $$(".legend-chip").forEach(c => c.classList.toggle("on", c.dataset.zona === zonaId));
  const car = $(".m-car", map);
  cancelAnimationFrame(carAnim);
  if (!car) return;
  if (!zonaId) { car.setAttribute("opacity", 0); return; }
  const path = $(`.m-route[data-zona="${zonaId}"]`, map);
  if (!path) return;
  const len = path.getTotalLength();
  car.setAttribute("opacity", 1);
  const t0 = performance.now(), dur = 2600 + len * 6;
  const step = t => {
    let p = ((t - t0) % (dur + 600)) / dur;
    p = Math.min(p, 1);
    const pt = path.getPointAtLength((reverse ? 1 - p : p) * len);
    car.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
    carAnim = requestAnimationFrame(step);
  };
  carAnim = requestAnimationFrame(step);
}

function selectZona(id) {
  $("#fZona").value = id;
  filters.zona = id;
  renderRides();
  highlightRoute(id);
}

/* ---------------- LISTA DE RAITES ---------------- */
const filters = { zona: "todas", tipo: "todos", turno: "todos", soloLibres: false };
let currentRides = [];   // últimos raites recibidos (los usa el modal de reserva)
let ridesReq = 0;        // evita que una respuesta lenta pise a una más reciente

function rideCard(r) {
  const z = zonaById(r.zona);
  const free = Math.max(r.libres, 0);     // el servidor ya calcula asientos − reservas del día
  const seats = Array.from({ length: r.asientos }, (_, i) => `<i class="${i < free ? "free" : ""}"></i>`).join("");
  const ruta = r.tipo === "ida" ? `${esc(z.nombre)} → UTP` : `UTP → ${esc(z.nombre)}`;
  return `
    <article class="ride ${selectedRide === r.id ? "on" : ""}" data-id="${r.id}" style="--zc:${esc(z.color)}" tabindex="0">
      <div class="avatar" style="background:${esc(z.color)}">${initials(r.conductor.nombre)}</div>
      <div class="ride__main">
        <div class="ride__top">
          <span class="ride__time">${r.hora}</span>
          <span class="tag tag--${r.tipo}">${r.tipo}</span>
        </div>
        <div class="ride__route">${ruta}</div>
        <div class="ride__meta">${esc(r.conductor.nombre)} · ⭐ ${r.conductor.rating} · ${esc(r.auto)}</div>
      </div>
      <div class="ride__side">
        <div class="price">${money(r.aportacion)}<small>aportación</small></div>
        ${free > 0 ? `<div class="seats" title="${free} lugares libres">${seats}</div>` : `<span class="full-badge">LLENO</span>`}
      </div>
    </article>`;
}

async function renderRides() {
  const mine = ++ridesReq;
  let list;
  try {
    list = await API.raites({
      zona: filters.zona, tipo: filters.tipo, turno: filters.turno,
      libres: filters.soloLibres ? "true" : undefined
    });
  } catch {
    list = null;
  }
  if (mine !== ridesReq) return;

  if (list === null) {
    $("#ridesCount").textContent = "No se pudieron cargar los raites";
    $("#ridesList").innerHTML = `<div class="empty">📡 Sin conexión con el servidor.<br>Revisa tu internet e inténtalo de nuevo.</div>`;
    return;
  }
  currentRides = list;
  $("#ridesCount").textContent = `${list.length} raite${list.length === 1 ? "" : "s"} encontrado${list.length === 1 ? "" : "s"}`;
  $("#ridesList").innerHTML = list.length
    ? list.map(rideCard).join("")
    : `<div class="empty">😕 No hay raites con esos filtros.<br>Prueba otra zona u horario.</div>`;

  $$(".ride").forEach(el => {
    const open = () => {
      const r = currentRides.find(x => x.id === +el.dataset.id);
      selectedRide = r.id;
      $$(".ride").forEach(c => c.classList.toggle("on", c === el));
      highlightRoute(r.zona, r.tipo === "regreso");
      openReserva(r);
    };
    el.addEventListener("click", open);
    el.addEventListener("keydown", e => { if (e.key === "Enter") open(); });
  });
}

$("#fZona").addEventListener("change", e => {
  filters.zona = e.target.value;
  renderRides();
  highlightRoute(filters.zona === "todas" ? null : filters.zona);
});
$("#fTurno").addEventListener("change", e => { filters.turno = e.target.value; renderRides(); });
$("#fLibres").addEventListener("change", e => { filters.soloLibres = e.target.checked; renderRides(); });
$$("[data-tipo]").forEach(b => b.addEventListener("click", () => {
  $$("[data-tipo]").forEach(x => x.classList.toggle("active", x === b));
  filters.tipo = b.dataset.tipo;
  renderRides();
}));

// Búsqueda desde el hero
$("#heroSearch").addEventListener("submit", e => {
  e.preventDefault();
  filters.zona = $("#heroZona").value;
  filters.turno = $("#heroTurno").value;
  $("#fZona").value = filters.zona;
  $("#fTurno").value = filters.turno;
  renderRides();
  highlightRoute(filters.zona === "todas" ? null : filters.zona);
  $("#rutas").scrollIntoView();
});

/* ---------------- MODAL ---------------- */
const modal = $("#modal");
function openModal(html) {
  $("#modalBody").innerHTML = html;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}
modal.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });
addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

/* ---------------- MODAL: apartar lugar ---------------- */
function openReserva(r) {
  const z = zonaById(r.zona);
  const destino = r.tipo === "ida" ? [...r.paradas, "UTP · Puerta principal"] : ["UTP · Puerta principal", ...r.paradas];
  const libresDe = d => Math.max(r.libresPorDia?.[d] ?? r.libres, 0);
  let dia = r.dia;   // el servidor manda el primer día de salida desde hoy

  openModal(`
    <h3 id="modalTitle">${r.tipo === "ida" ? esc(z.nombre) + " → UTP" : "UTP → " + esc(z.nombre)}</h3>
    <p style="color:var(--muted);margin:0">Sale a las <b style="color:var(--ink)">${r.hora}</b> · <span id="rLibres"></span></p>
    <div class="m-driver">
      <div class="avatar" style="background:${esc(z.color)}">${initials(r.conductor.nombre)}</div>
      <div><b>${esc(r.conductor.nombre)}</b><small>${esc(r.conductor.carrera || "")} · ${r.conductor.cuatri ?? "–"}° cuatri · ⭐ ${r.conductor.rating} (${r.conductor.viajes} viajes)</small><small>🚗 ${esc(r.auto)}</small></div>
    </div>
    <ul class="stops" style="--zc:${esc(z.color)}">${destino.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
    <p style="font-weight:700;margin-bottom:8px">¿Qué día viajas?</p>
    <div class="pick-days">${DIAS.map((d, i) => `<button type="button" data-dia="${i}" ${r.dias.includes(i) ? "" : "disabled"} class="${i === dia ? "active" : ""}">${d}</button>`).join("")}</div>
    <label class="field"><span>Tu nombre</span><input type="text" id="rNombre" placeholder="¿Cómo te llamas?" value="${esc(API.user?.nombre || store.get("ru-nombre", ""))}"></label>
    <label class="field"><span>¿Dónde te subes?</span><select id="rParada">${(r.tipo === "ida" ? r.paradas : ["UTP · Puerta principal"]).map(p => `<option>${esc(p)}</option>`).join("")}</select></label>
    <button class="btn btn--primary btn--lg btn--block" id="rOk"></button>
  `);

  // Texto de cupo y botón según el día elegido
  const pintarCupo = () => {
    const free = libresDe(dia);
    $("#rLibres").textContent = free > 0 ? `${free} lugar${free > 1 ? "es" : ""} libre${free > 1 ? "s" : ""}` : "sin lugares";
    $("#rOk").disabled = free === 0;
    $("#rOk").textContent = free > 0 ? `Apartar lugar · ${money(r.aportacion)}` : "Raite lleno";
  };
  pintarCupo();

  $$(".pick-days button").forEach(b => b.addEventListener("click", () => {
    dia = +b.dataset.dia;
    $$(".pick-days button").forEach(x => x.classList.toggle("active", x === b));
    pintarCupo();
  }));

  $("#rOk").addEventListener("click", async () => {
    const nombre = $("#rNombre").value.trim();
    if (!nombre) { $("#rNombre").focus(); $("#rNombre").closest(".field").classList.add("invalid"); return; }
    if (!API.user) {   // apartar requiere cuenta; al entrar se reabre este mismo raite
      openAuth({ aviso: "Inicia sesión con tu correo @utpuebla.edu.mx para apartar tu lugar.", despues: () => openReserva(r) });
      return;
    }
    store.set("ru-nombre", nombre);
    const btn = $("#rOk");
    btn.disabled = true;
    try {
      const res = await API.reservar({ raiteId: r.id, dia, parada: $("#rParada").value, nombre });
      renderRides(); renderMyTrips(); renderTimeline();
      openModal(`
        <div class="success">
          <div class="success__icon">✓</div>
          <h3 style="margin-right:0">¡Lugar apartado, ${esc(nombre.split(" ")[0])}!</h3>
          <p style="color:var(--muted)">${DIAS[dia]} a las ${r.hora} con ${esc(r.conductor.nombre.split(" ")[0])}.<br>Muestra este código al subir:</p>
          <code>${esc(res.codigo)}</code>
          <button class="btn btn--dark btn--block" data-close>Listo</button>
        </div>`);
      toast("🎉 Tu lugar quedó apartado");
    } catch (err) {
      btn.disabled = false;
      toast(err.code === "SIN_CONEXION" ? "📡 Necesitas conexión para apartar tu lugar" : "⚠️ " + err.message);
      if (err.code === "RAITE_LLENO") { renderRides(); renderTimeline(); closeModal(); }
    }
  });
}

/* ---------------- Mis viajes ---------------- */
async function renderMyTrips() {
  if (!API.user) { $("#myTrips").hidden = true; return; }
  let reservas;
  try { reservas = await API.misReservas(); } catch { return; }
  $("#myTrips").hidden = reservas.length === 0;
  $("#myTripsList").innerHTML = reservas.map(v => {
    const z = zonaById(v.zona);
    return `<div class="ticket" style="--zc:${esc(z.color)}">
      <b>${DIAS[v.dia]} · ${v.hora}</b>
      <p>${v.tipo === "ida" ? esc(z.nombre) + " → UTP" : "UTP → " + esc(z.nombre)}</p>
      <p>Te subes en: ${esc(v.parada)}</p>
      <p>Código: <code>${esc(v.codigo)}</code></p>
      <button data-cancel="${esc(v.codigo)}">Cancelar</button>
    </div>`;
  }).join("");
  $$("[data-cancel]").forEach(b => b.addEventListener("click", async () => {
    try {
      await API.cancelar(b.dataset.cancel);
      renderRides(); renderMyTrips(); renderTimeline();
      toast("Reservación cancelada");
    } catch (err) {
      toast(err.code === "SIN_CONEXION" ? "📡 Necesitas conexión para cancelar" : "⚠️ " + err.message);
    }
  }));
}

/* ---------------- HORARIOS ---------------- */
const hoyIdx = (new Date().getDay() + 6) % 7; // 0 = lunes … 6 = domingo
let diaSel = hoyIdx > 5 ? 0 : hoyIdx;
let timelineReq = 0;

function renderDayTabs() {
  $("#dayTabs").innerHTML = DIAS.map((d, i) =>
    `<button class="day-tab ${i === diaSel ? "active" : ""}" role="tab" data-d="${i}">${d}${i === hoyIdx ? '<span class="today">HOY</span>' : ""}</button>`).join("");
  $$(".day-tab").forEach(b => b.addEventListener("click", () => { diaSel = +b.dataset.d; renderDayTabs(); renderTimeline(); }));
}

async function renderTimeline() {
  const mine = ++timelineReq;
  let list;
  try { list = await API.raites({ dia: diaSel }); } catch { list = null; }
  if (mine !== timelineReq) return;
  if (list === null) { $("#timeline").innerHTML = `<div class="empty">📡 No se pudieron cargar los horarios.</div>`; return; }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const esHoy = diaSel === hoyIdx;
  const toMin = h => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
  const next = esHoy ? list.find(r => toMin(r.hora) >= nowMin) : null;

  const grupos = { "🌅 Mañana": [], "☀️ Tarde": [], "🌙 Noche": [] };
  list.forEach(r => {
    const m = toMin(r.hora);
    (m < 720 ? grupos["🌅 Mañana"] : m < 1080 ? grupos["☀️ Tarde"] : grupos["🌙 Noche"]).push(r);
  });

  let html = "", nowDrawn = !esHoy;
  for (const [titulo, items] of Object.entries(grupos)) {
    if (!items.length) continue;
    html += `<div class="t-group"><h4>${titulo}</h4>`;
    items.forEach(r => {
      const m = toMin(r.hora), z = zonaById(r.zona);
      if (!nowDrawn && m >= nowMin) { html += `<div class="now-line">AHORA · ${now.toTimeString().slice(0, 5)}</div>`; nowDrawn = true; }
      const past = esHoy && m < nowMin;
      const falta = m - nowMin;
      const badge = r === next
        ? `<span class="t-badge">Sale en ${falta >= 60 ? Math.floor(falta / 60) + " h " + (falta % 60) + " min" : falta + " min"}</span>`
        : `<span style="font-weight:700">${(n => n === 0 ? "Lleno" : n + (n === 1 ? " lugar" : " lugares"))(Math.max(r.libresPorDia?.[diaSel] ?? r.libres, 0))}</span>`;
      html += `<div class="t-item ${past ? "past" : ""} ${r === next ? "next" : ""}" style="--zc:${esc(z.color)}">
        <span class="t-time">${r.hora}</span>
        <div class="t-info"><b>${r.tipo === "ida" ? esc(z.nombre) + " → UTP" : "UTP → " + esc(z.nombre)}</b><small>${esc(r.conductor.nombre)} · ${money(r.aportacion)}</small></div>
        ${badge}
      </div>`;
    });
    html += `</div>`;
  }
  if (!nowDrawn) html += `<div class="now-line">AHORA · ${now.toTimeString().slice(0, 5)} · ya salieron todos los raites de hoy</div>`;
  $("#timeline").innerHTML = html || `<div class="empty">No hay salidas este día.</div>`;
}
setInterval(renderTimeline, 60000);

/* ---------------- CALCULADORA ---------------- */
let rol = "conductor";
const inputs = { km: $("#cKm"), dias: $("#cDias"), pas: $("#cPas"), rend: $("#cRend"), precio: $("#cPrecio") };

function paintRange(el) {
  el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min)) * 100 + "%");
}

function animateNumber(el, to, fmt) {
  const from = +(el.dataset.v || 0);
  el.dataset.v = to;
  const t0 = performance.now();
  const tick = t => {
    const p = Math.min((t - t0) / 500, 1);
    el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Respaldo local (misma fórmula que el servicio del backend) para cuando no hay conexión
function calcularLocal({ rol, km, dias, pasajeros: pas, rendimiento: rend, precio }) {
  const kmMes = km * 2 * dias * 4.3;
  const litrosMes = kmMes / (rol === "conductor" ? rend : 14);
  const gasMes = litrosMes * precio;
  if (rol === "conductor") {
    const tuParte = gasMes / (pas + 1);
    const litros = litrosMes * pas;
    return {
      ahorroMes: gasMes - tuParte, ahorroCuatri: (gasMes - tuParte) * 4, litros, co2Kg: litros * CONFIG.co2PorLitro,
      asientos: pas * dias * 2 * 4.3,
      barras: [
        { label: "Manejando solo", val: gasMes, color: "#E5484D" },
        { label: `Con Rodando (${pas + 1} personas)`, val: tuParte, color: "#14B8A6" }
      ],
      etiqueta: "Recuperas al mes",
      nota: `Gastas ${money(gasMes)} de gasolina al mes. Dividido entre ${pas + 1} personas, a ti solo te toca ${money(tuParte)}. Los ${Math.round(litros)} L ahorrados salen de los coches que tus compañeros ya no usan.`
    };
  }
  const viajes = dias * 2 * 4.3;
  const uber = viajes * (CONFIG.tarifaUberBase + km * CONFIG.tarifaUberKm);
  const camiones = km > 10 ? 3 : 2;
  const transporte = viajes * CONFIG.pasajeTransporte * camiones;
  const rodando = gasMes / 4;
  const litros = litrosMes * 0.75;
  const horas = viajes * (km > 10 ? 0.6 : 0.35);
  return {
    ahorroMes: uber - rodando, ahorroCuatri: (uber - rodando) * 4, litros, co2Kg: litros * CONFIG.co2PorLitro, horas,
    barras: [
      { label: "Uber / DiDi", val: uber, color: "#E5484D" },
      { label: `Transporte público (${camiones} camiones)`, val: transporte, color: "#FF8A3D" },
      { label: "Rodando UTP", val: rodando, color: "#14B8A6" }
    ],
    etiqueta: "Te ahorras al mes (vs. Uber)",
    nota: `Comparado con el transporte público ahorras ${money(Math.max(transporte - rodando, 0))} al mes y ${Math.round(horas)} horas de camión.`
  };
}

function pintarResultado(res) {
  $("#rLabel").textContent = res.etiqueta;
  animateNumber($("#rMes"), res.ahorroMes, money);
  animateNumber($("#rCuatri"), res.ahorroCuatri, money);
  animateNumber($("#rCo2"), res.co2Kg, v => Math.round(v) + " kg");
  animateNumber($("#rLitros"), res.litros, v => Math.round(v) + " L");
  if (res.asientos !== undefined) {
    animateNumber($("#rTiempo"), res.asientos, v => Math.round(v));
    $("#rTiempoLbl").textContent = "asientos llenos al mes";
  } else {
    animateNumber($("#rTiempo"), res.horas, v => Math.round(v) + " h");
    $("#rTiempoLbl").textContent = "menos en transporte";
  }
  $("#rNote").textContent = res.nota;

  const max = Math.max(...res.barras.map(b => b.val));
  $("#bars").innerHTML = res.barras.map(b => `
    <div class="bar">
      <div class="bar__head"><span>${esc(b.label)}</span><b>${money(b.val)}/mes</b></div>
      <div class="bar__track"><div class="bar__fill" style="background:${esc(b.color)}" data-w="${(b.val / max) * 100}"></div></div>
    </div>`).join("");
  requestAnimationFrame(() => requestAnimationFrame(() =>
    $$(".bar__fill").forEach(f => f.style.width = f.dataset.w + "%")));
}

let calcSeq = 0, calcTimer = null;
function calcular() {
  const km = +inputs.km.value, dias = +inputs.dias.value, pas = +inputs.pas.value;
  const rend = +inputs.rend.value, precio = +inputs.precio.value;
  Object.values(inputs).forEach(paintRange);

  $("#oKm").textContent = km + " km";
  $("#oDias").textContent = dias + (dias === 1 ? " día" : " días");
  $("#oPas").textContent = pas;
  $("#oRend").textContent = rend + " km/L";
  $("#oPrecio").textContent = "$" + precio.toFixed(2);

  // El cálculo lo hace el backend (POST /api/calculadora); se espera un instante
  // para no saturar la API mientras se arrastra el control.
  const entrada = { rol, km, dias, pasajeros: pas, rendimiento: rend, precio };
  const mine = ++calcSeq;
  clearTimeout(calcTimer);
  calcTimer = setTimeout(async () => {
    let res;
    try { res = await API.calculadora(entrada); } catch { res = calcularLocal(entrada); }
    if (mine === calcSeq) pintarResultado(res);
  }, 120);
}

Object.values(inputs).forEach(el => el.addEventListener("input", calcular));
$("#cZona").addEventListener("change", e => { inputs.km.value = zonaById(e.target.value).km; calcular(); });
$$("[data-rol]").forEach(b => b.addEventListener("click", () => {
  rol = b.dataset.rol;
  $$("[data-rol]").forEach(x => x.classList.toggle("active", x === b));
  $("#wrapPas").hidden = rol !== "conductor";
  $("#wrapRend").hidden = rol !== "conductor";
  calcular();
}));

/* ---------------- TESTIMONIOS (carrusel) ---------------- */
const colores = ["#FF8A3D", "#14B8A6", "#8B5CF6", "#0EA5E9"];
let slide = 0, slideTimer;
function renderTestimonios() {
  $("#carouselTrack").innerHTML = TESTIMONIOS.map((t, i) => `
    <div class="quote"><div class="quote__box">
      <p class="quote__text">${esc(t.texto)}</p>
      <div class="quote__who"><div class="avatar" style="background:${colores[i % 4]}">${initials(t.nombre)}</div>
      <div><b>${esc(t.nombre)}</b><small>${esc(t.rol)}</small></div></div>
    </div></div>`).join("");
  $("#carouselDots").innerHTML = TESTIMONIOS.map((_, i) => `<button aria-label="Testimonio ${i + 1}" data-i="${i}"></button>`).join("");
  $$("#carouselDots button").forEach(b => b.addEventListener("click", () => goSlide(+b.dataset.i)));
  goSlide(0);
}
function goSlide(i) {
  if (!TESTIMONIOS.length) return;
  slide = (i + TESTIMONIOS.length) % TESTIMONIOS.length;
  $("#carouselTrack").style.transform = `translateX(-${slide * 100}%)`;
  $$("#carouselDots button").forEach((b, j) => b.classList.toggle("active", j === slide));
  clearInterval(slideTimer);
  slideTimer = setInterval(() => goSlide(slide + 1), 5500);
}
// Deslizar con el dedo en el celular
let touchX = null;
$("#carousel").addEventListener("touchstart", e => touchX = e.touches[0].clientX, { passive: true });
$("#carousel").addEventListener("touchend", e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 40) goSlide(slide + (dx < 0 ? 1 : -1));
  touchX = null;
});

/* ---------------- FAQ (el HTML estático sirve de respaldo) ---------------- */
async function renderFaq() {
  try {
    const faq = await API.faq();
    if (!faq.length) return;
    $(".faq").innerHTML = faq.map((f, i) =>
      `<details ${i === 0 ? "open" : ""}><summary>${esc(f.pregunta)}</summary><p>${f.respuesta}</p></details>`).join("");
  } catch { /* se queda el HTML estático */ }
}

/* ---------------- FORMULARIO DE CONDUCTOR ---------------- */
$("#driverForm").addEventListener("submit", async e => {
  e.preventDefault();
  let ok = true;
  const check = (id, valid, msg) => {
    const f = $(id).closest(".field");
    f.classList.toggle("invalid", !valid);
    f.querySelector(".err").textContent = valid ? "" : msg;
    if (!valid) ok = false;
  };
  const nombre = $("#dNombre").value.trim();
  check("#dNombre", nombre.split(/\s+/).length >= 2, "Escribe tu nombre y apellido.");
  check("#dCorreo", /^[^\s@]+@utpuebla\.edu\.mx$/i.test($("#dCorreo").value.trim()), "Usa tu correo institucional @utpuebla.edu.mx");
  check("#dAuto", $("#dAuto").value.trim().length >= 3, "Dinos qué coche tienes.");
  check("#dHora", !!$("#dHora").value, "Elige una hora.");
  const acepto = $("#dAcepto").checked;
  $("#errAcepto").textContent = acepto ? "" : "Debes aceptar el reglamento.";
  if (!acepto) ok = false;
  if (!ok) { toast("⚠️ Revisa los campos marcados"); return; }

  const form = e.target;
  const z = zonaById($("#dZona").value);
  let res;
  try {
    res = await API.solicitudConductor({
      nombre, correo: $("#dCorreo").value.trim(), auto: $("#dAuto").value.trim(),
      zona: z.id, hora: $("#dHora").value, lugares: +$("#dLugares").value
    });
  } catch (err) {
    toast(err.code === "SIN_CONEXION" ? "📡 Necesitas conexión para enviar tu registro" : "⚠️ " + err.message);
    return;
  }
  openModal(`
    <div class="success">
      <div class="success__icon">🚗</div>
      <h3 style="margin-right:0">¡Bienvenido a bordo, ${esc(nombre.split(" ")[0])}!</h3>
      <p style="color:var(--muted)">Tu ruta <b style="color:var(--ink)">${esc(z.nombre)} → UTP</b> a las <b style="color:var(--ink)">${esc($("#dHora").value)}</b> con ${esc($("#dLugares").value)} lugar(es) quedó en revisión.
      Te avisaremos a <b style="color:var(--ink)">${esc($("#dCorreo").value.trim())}</b> cuando esté publicada.</p>
      <p style="font-weight:700">Aportación sugerida por pasajero: ${money(res.aportacionSugerida)}</p>
      <button class="btn btn--dark btn--block" data-close>Entendido</button>
    </div>`);
  form.reset();
});

/* ---------------- CUENTA: acceso, registro y perfil ---------------- */
function pintarCuenta() {
  const u = API.user;
  $("#accountLabel").textContent = u ? u.nombre.split(" ")[0] : "Entrar";
  $("#accountBtn").classList.toggle("logged", Boolean(u));
}
addEventListener("auth-change", () => { pintarCuenta(); renderMyTrips(); });

function openAuth({ aviso = "", despues = null, modo = "login" } = {}) {
  openModal(`
    <h3 id="modalTitle">Tu cuenta</h3>
    <p style="color:var(--muted);margin:0 0 14px">${esc(aviso) || "Solo estudiantes con correo <b>@utpuebla.edu.mx</b>."}</p>
    <div class="seg" role="group" aria-label="Acceso" style="margin-bottom:16px">
      <button type="button" class="seg__btn ${modo === "login" ? "active" : ""}" data-modo="login">Entrar</button>
      <button type="button" class="seg__btn ${modo === "registro" ? "active" : ""}" data-modo="registro">Crear cuenta</button>
    </div>
    <form id="authForm" novalidate>
      <label class="field reg-only"><span>Nombre completo</span><input type="text" id="aNombre" autocomplete="name" placeholder="Ej. Mariana López"><small class="err"></small></label>
      <label class="field"><span>Correo institucional</span><input type="email" id="aCorreo" autocomplete="email" placeholder="matricula@utpuebla.edu.mx"><small class="err"></small></label>
      <label class="field"><span>Contraseña</span><input type="password" id="aPass" autocomplete="current-password" placeholder="Mínimo 8 caracteres"><small class="err"></small></label>
      <div class="reg-only">
        <div class="seg" role="group" aria-label="Tipo de cuenta" style="margin-bottom:16px">
          <button type="button" class="seg__btn active" data-arol="pasajero">🎒 Soy pasajero</button>
          <button type="button" class="seg__btn" data-arol="conductor">🚗 Tengo coche</button>
        </div>
        <label class="field" id="aAutoWrap" hidden><span>Coche (modelo y color)</span><input type="text" id="aAuto" placeholder="Ej. Nissan March gris"><small class="err"></small></label>
      </div>
      <small class="err" id="aError" style="display:block;margin-bottom:10px"></small>
      <button class="btn btn--primary btn--lg btn--block" type="submit" id="aOk"></button>
    </form>`);

  let m = modo, arol = "pasajero";
  const pintar = () => {
    $$(".reg-only").forEach(el => el.hidden = m !== "registro");
    $$("[data-modo]").forEach(b => b.classList.toggle("active", b.dataset.modo === m));
    $("#aOk").textContent = m === "login" ? "Entrar" : "Crear mi cuenta";
    $("#aPass").autocomplete = m === "login" ? "current-password" : "new-password";
    $("#aAutoWrap").hidden = m !== "registro" || arol !== "conductor";
  };
  pintar();
  $$("[data-modo]").forEach(b => b.addEventListener("click", () => { m = b.dataset.modo; pintar(); }));
  $$("[data-arol]").forEach(b => b.addEventListener("click", () => {
    arol = b.dataset.arol;
    $$("[data-arol]").forEach(x => x.classList.toggle("active", x === b));
    pintar();
  }));

  $("#authForm").addEventListener("submit", async e => {
    e.preventDefault();
    const marca = (id, msg) => { const f = $(id).closest(".field"); f.classList.toggle("invalid", Boolean(msg)); f.querySelector(".err").textContent = msg || ""; return !msg; };
    const correo = $("#aCorreo").value.trim(), pass = $("#aPass").value, nombre = $("#aNombre").value.trim(), auto = $("#aAuto").value.trim();
    $("#aError").textContent = "";
    let ok = marca("#aCorreo", /^[^\s@]+@utpuebla\.edu\.mx$/i.test(correo) ? "" : "Usa tu correo institucional @utpuebla.edu.mx");
    ok = marca("#aPass", pass.length >= (m === "registro" ? 8 : 1) ? "" : "Mínimo 8 caracteres") && ok;
    if (m === "registro") {
      ok = marca("#aNombre", nombre.length >= 3 ? "" : "Escribe tu nombre completo") && ok;
      if (arol === "conductor") ok = marca("#aAuto", auto.length >= 3 ? "" : "Dinos qué coche tienes") && ok;
    }
    if (!ok) return;

    $("#aOk").disabled = true;
    try {
      const usuario = m === "login"
        ? await API.login({ correo, password: pass })
        : await API.registro({ nombre, correo, password: pass, rol: arol, ...(arol === "conductor" && { auto }) });
      toast(`👋 ¡Hola, ${usuario.nombre.split(" ")[0]}!`);
      closeModal();
      if (despues) despues();
    } catch (err) {
      $("#aOk").disabled = false;
      $("#aError").textContent = err.code === "SIN_CONEXION" ? "Necesitas conexión para entrar." : err.message;
    }
  });
}

function openPerfil() {
  const u = API.user;
  const pushOk = "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
  openModal(`
    <div class="success">
      <div class="success__icon">🎓</div>
      <h3 style="margin-right:0">${esc(u.nombre)}</h3>
      <p style="color:var(--muted)">${esc(u.correo)}<br>Cuenta de ${u.rol}</p>
      ${pushOk ? `<button class="btn btn--primary btn--block" id="pushBtn" style="margin-bottom:10px">🔔 Activar avisos</button>` : ""}
      <button class="btn btn--dark btn--block" id="logoutBtn">Cerrar sesión</button>
    </div>`);
  $("#logoutBtn").addEventListener("click", () => { API.logout(); closeModal(); toast("Sesión cerrada"); });
  $("#pushBtn")?.addEventListener("click", activarPush);
}
$("#accountBtn").addEventListener("click", () => (API.user ? openPerfil() : openAuth()));

// Notificaciones push (el conductor recibe un aviso cuando alguien aparta lugar)
const b64ToBytes = b64 => Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64.length / 4) * 4, "=")), c => c.charCodeAt(0));
async function activarPush() {
  try {
    if (await Notification.requestPermission() !== "granted") return toast("Permiso de notificaciones denegado");
    const { publicKey } = await API.pushKey();
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
    await API.pushSubscribe(sub.toJSON());
    toast("🔔 Avisos activados");
  } catch (err) {
    toast(err.code === "PUSH_NO_CONFIGURADO" ? "Los avisos aún no están disponibles" : "No se pudieron activar los avisos");
  }
}

/* ---------------- Notificaciones (toasts) ---------------- */
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 2800);
}

/* ---------------- PWA: instalación y modo offline ---------------- */
let deferredPrompt = null;
addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  $("#installBtn").hidden = false;
});
$("#installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") toast("📲 ¡Rodando UTP instalada!");
  deferredPrompt = null;
  $("#installBtn").hidden = true;
});
addEventListener("appinstalled", () => { $("#installBtn").hidden = true; });

// La barra aparece sin internet o cuando se muestran datos guardados porque la API no responde
const MSG_OFFLINE = "Sin conexión · estás usando la versión guardada de Rodando UTP";
const MSG_API = "No hay conexión con el servidor · mostrando la última información guardada";
function updateOnline() {
  const sinRed = !navigator.onLine, sinApi = API.state.stale;
  $("#offlineBar").textContent = sinRed ? MSG_OFFLINE : MSG_API;
  $("#offlineBar").classList.toggle("show", sinRed || sinApi);
}
function recargarDatos() { renderRides(); renderTimeline(); renderMyTrips(); }
addEventListener("online", () => { updateOnline(); toast("✅ Conexión recuperada"); recargarDatos(); });
addEventListener("offline", updateOnline);
addEventListener("api-status", updateOnline);
updateOnline();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  // Al tocar una notificación el service worker pide abrir una sección
  navigator.serviceWorker.addEventListener("message", e => { if (e.data?.irA) location.hash = e.data.irA; });
}

/* ---------------- Inicio ---------------- */
async function init() {
  $("#year").textContent = new Date().getFullYear();
  pintarCuenta();
  renderDayTabs();
  onScroll();
  initStats();

  // Catálogos primero (el mapa y los selects dependen de las zonas)
  const [zonas, config, testimonios] = await Promise.allSettled([API.zonas(), API.config(), API.testimonios()]);
  if (zonas.status === "fulfilled") ZONAS = zonas.value;
  if (config.status === "fulfilled") CONFIG = { ...CONFIG, ...config.value };
  if (testimonios.status === "fulfilled") TESTIMONIOS = testimonios.value;

  fillAllZonas();
  buildMap();
  renderTestimonios();
  renderFaq();
  renderRides();
  renderMyTrips();
  renderTimeline();
  calcular();
}
init();
