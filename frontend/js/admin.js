/* =========================================================
   Rodando UTP · Panel de administración
   CRUD de varias tablas (raites, zonas, testimonios, FAQ,
   usuarios, reservas, solicitudes) con actualización
   automática cada 4 s (polling de la API).
   ========================================================= */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const REFRESCO_MS = 4000;
try { const t = JSON.parse(localStorage.getItem("ru-theme")); if (t) document.documentElement.dataset.theme = t; } catch { /* sin tema */ }

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 2800);
}
const cut = (s, n = 60) => (s.length > n ? s.slice(0, n) + "…" : s);

/* Definición de cada pestaña:
   url: endpoint de lectura · cols: [título, función(fila)] · id: llave de la fila
   campos: formulario de crear/editar · acciones: botones extra por fila */
const ENT = {
  raites: {
    titulo: "Raites", url: "/admin/raites", id: r => r.id, recurso: null,
    cols: [["ID", r => r.id], ["Ruta", r => `${esc(r.zona)} · ${r.tipo}`], ["Hora", r => r.hora], ["Conductor", r => esc(r.conductor.nombre)],
      ["Días", r => r.dias.map(d => DIAS[d]).join(", ")], ["Libres", r => `${r.libres}/${r.asientos}`], ["$", r => r.aportacion],
      ["Estado", r => `<span class="pill-s ${r.activo ? "on" : ""}">${r.activo ? "Activo" : "Pausado"}</span>`]],
    campos: [
      { k: "hora", label: "Hora", tipo: "time" },
      { k: "asientos", label: "Asientos", tipo: "number", min: 1, max: 8 },
      { k: "aportacion", label: "Aportación ($)", tipo: "number", min: 0, max: 500 },
      { k: "activo", label: "Activo (visible para pasajeros)", tipo: "checkbox" }],
    editar: (r, d) => API.req("PATCH", `/raites/${r.id}`, d),
    borrar: r => API.req("DELETE", `/raites/${r.id}`),
    nota: "Los raites nuevos los publican los conductores desde su panel."
  },
  zonas: {
    titulo: "Zonas", url: "/admin/zonas", id: r => r.id, recurso: "zonas", crear: true,
    cols: [["Id", r => esc(r.id)], ["Nombre", r => esc(r.nombre)], ["Km", r => r.km], ["x / y", r => `${r.x} / ${r.y}`],
      ["Color", r => `<i class="dot-c" style="background:${esc(r.color)}"></i>${esc(r.color)}`]],
    campos: [
      { k: "id", label: "Id (minúsculas, sin espacios)", tipo: "text", soloCrear: true },
      { k: "nombre", label: "Nombre", tipo: "text" },
      { k: "km", label: "Km a la UTP", tipo: "number", min: 1, max: 60 },
      { k: "x", label: "Posición x en el mapa (0-600)", tipo: "number", min: 0, max: 600 },
      { k: "y", label: "Posición y en el mapa (0-420)", tipo: "number", min: 0, max: 420 },
      { k: "color", label: "Color", tipo: "color" },
      { k: "trazo_svg", label: "Trazo SVG hacia la UTP", tipo: "textarea", def: "M100 200 C 200 180, 340 160, 440 140" }]
  },
  testimonios: {
    titulo: "Testimonios", url: "/admin/testimonios", id: r => r.id, recurso: "testimonios", crear: true,
    cols: [["ID", r => r.id], ["Nombre", r => esc(r.nombre)], ["Rol", r => esc(r.rol)], ["Texto", r => esc(cut(r.texto, 80))]],
    campos: [
      { k: "nombre", label: "Nombre", tipo: "text" },
      { k: "rol", label: "Rol (ej. Pasajera · Ing. en Software)", tipo: "text" },
      { k: "texto", label: "Testimonio", tipo: "textarea" }]
  },
  faq: {
    titulo: "FAQ", url: "/admin/faq", id: r => r.id, recurso: "faq", crear: true,
    cols: [["ID", r => r.id], ["Pregunta", r => esc(r.pregunta)], ["Respuesta", r => esc(cut(r.respuesta.replace(/<[^>]+>/g, ""), 80))]],
    campos: [
      { k: "pregunta", label: "Pregunta", tipo: "text" },
      { k: "respuesta", label: "Respuesta", tipo: "textarea" }]
  },
  usuarios: {
    titulo: "Usuarios", url: "/admin/usuarios", id: r => r.id,
    cols: [["ID", r => r.id], ["Nombre", r => esc(r.nombre)], ["Correo", r => esc(r.correo)], ["Rol", r => `<span class="pill-s ${r.rol === "admin" ? "on" : ""}">${r.rol}</span>`],
      ["Coche", r => esc(r.auto || "–")], ["Alta", r => new Date(r.creado).toLocaleDateString("es-MX")]],
    campos: [{ k: "rol", label: "Rol", tipo: "select", opts: ["pasajero", "conductor", "admin"] }],
    editar: (r, d) => API.req("PATCH", `/admin/usuarios/${r.id}`, d),
    borrar: r => API.req("DELETE", `/admin/usuarios/${r.id}`)
  },
  reservas: {
    titulo: "Reservas", url: "/admin/reservas", id: r => r.codigo,
    cols: [["Código", r => `<code>${esc(r.codigo)}</code>`], ["Nombre", r => esc(r.nombre)], ["Usuario", r => esc(r.usuario || "(demo)")],
      ["Raite", r => `${esc(r.zona)} ${r.hora}`], ["Día", r => DIAS[r.dia]], ["Parada", r => esc(r.parada)],
      ["Estado", r => `<span class="pill-s ${r.estado === "confirmada" ? "on" : ""}">${r.estado}</span>`]],
    acciones: r => (r.estado === "confirmada" ? [{ txt: "Cancelar", fn: () => API.req("DELETE", `/reservas/${r.codigo}`) }] : [])
  },
  solicitudes: {
    titulo: "Solicitudes", url: "/admin/solicitudes", id: r => r.id,
    cols: [["ID", r => r.id], ["Nombre", r => esc(r.nombre)], ["Correo", r => esc(r.correo)], ["Coche", r => esc(r.auto)],
      ["Zona", r => esc(r.zona)], ["Hora", r => r.hora], ["Estado", r => `<span class="pill-s ${r.estado === "aprobada" ? "on" : ""}">${r.estado}</span>`]],
    acciones: r => (r.estado === "pendiente" ? [{ txt: "✅ Aprobar", fn: () => API.req("POST", `/admin/solicitudes/${r.id}/aprobar`) }] : [])
  }
};

let tab = "raites", datos = [], firma = "", resumen = {}, timer = null, editando = null;

/* ---------- Pestañas con contador en vivo ---------- */
function pintarTabs() {
  $("#tabs").innerHTML = Object.entries(ENT).map(([k, e]) =>
    `<button class="tab ${k === tab ? "active" : ""}" data-t="${k}">${e.titulo}<span class="cnt">${resumen[k] ?? ""}</span></button>`).join("");
  $$("[data-t]").forEach(b => b.addEventListener("click", () => { tab = b.dataset.t; firma = ""; pintarTabs(); cargar(true); }));
}

/* ---------- READ (con refresco automático) ---------- */
async function cargar(forzar = false) {
  const e = ENT[tab];
  try {
    const [res, lista] = await Promise.all([API.req("GET", "/admin/resumen"), API.req("GET", e.url)]);
    const items = lista.items ?? lista.solicitudes;
    const nuevaFirma = JSON.stringify([items, res]);
    $("#liveTxt").textContent = "En vivo · " + new Date().toLocaleTimeString("es-MX");
    $("#live").classList.remove("off");
    if (!forzar && nuevaFirma === firma) return;       // sin cambios: no se repinta
    firma = nuevaFirma; datos = items; resumen = res;
    pintarTabs(); pintarTabla();
  } catch (err) {
    $("#live").classList.add("off");
    $("#liveTxt").textContent = err.code === "SIN_CONEXION" ? "Sin conexión" : "Error";
    if (err.status === 403) toast("⚠️ Esta cuenta no es administradora");
  }
}

function pintarTabla() {
  const e = ENT[tab];
  $("#newBtn").hidden = !e.crear;
  $("#thead").innerHTML = `<tr>${e.cols.map(c => `<th>${c[0]}</th>`).join("")}<th></th></tr>`;
  $("#emptyMsg").hidden = datos.length > 0;
  $("#tbl").hidden = datos.length === 0;
  $("#rows").innerHTML = datos.map((r, i) => `<tr>
    ${e.cols.map(c => `<td data-l="${c[0]}">${c[1](r)}</td>`).join("")}
    <td class="acts">
      ${(e.acciones?.(r) ?? []).map((a, j) => `<button class="btn btn--sm btn--primary" data-act="${i}:${j}">${a.txt}</button>`).join("")}
      ${e.campos && (e.recurso !== null || e.editar) ? `<button class="btn btn--sm btn--outline" data-edit="${i}">✏️ Editar</button>` : ""}
      ${e.recurso !== undefined || e.borrar ? `<button class="btn btn--sm btn--danger" data-del="${i}">🗑</button>` : ""}
    </td></tr>`).join("");
  $$("[data-edit]").forEach(b => b.addEventListener("click", () => abrirForm(datos[+b.dataset.edit])));
  $$("[data-del]").forEach(b => b.addEventListener("click", () => borrar(datos[+b.dataset.del])));
  $$("[data-act]").forEach(b => b.addEventListener("click", async () => {
    const [i, j] = b.dataset.act.split(":").map(Number);
    try { await e.acciones(datos[i])[j].fn(); toast("✅ Hecho"); cargar(true); } catch (err) { toast("⚠️ " + err.message); }
  }));
}

/* ---------- CREATE / UPDATE ---------- */
function abrirForm(fila = null) {
  const e = ENT[tab];
  editando = fila;
  $("#formTitle").textContent = (fila ? "Editar" : "Agregar") + " · " + e.titulo;
  $("#fields").innerHTML = e.campos.filter(c => !(fila && c.soloCrear)).map(c => {
    const v = fila ? fila[c.k] : (c.def ?? (c.tipo === "number" ? c.min ?? 0 : c.tipo === "color" ? "#7C3AED" : ""));
    if (c.tipo === "checkbox") return `<label class="check" style="margin-bottom:14px"><input type="checkbox" name="${c.k}" ${v ? "checked" : ""}> ${c.label}</label>`;
    const ctl = c.tipo === "textarea" ? `<textarea name="${c.k}" rows="3">${esc(v)}</textarea>`
      : c.tipo === "select" ? `<select name="${c.k}">${c.opts.map(o => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select>`
      : `<input name="${c.k}" type="${c.tipo}" value="${esc(v)}" ${c.min !== undefined ? `min="${c.min}" max="${c.max}"` : ""}>`;
    return `<label class="field"><span>${c.label}</span>${ctl}</label>`;
  }).join("");
  $("#fError").textContent = "";
  $("#modal").hidden = false;
}
const cerrarForm = () => { $("#modal").hidden = true; };
$("#modal").addEventListener("click", e => { if (e.target.closest("[data-close]")) cerrarForm(); });
addEventListener("keydown", e => { if (e.key === "Escape") cerrarForm(); });
$("#newBtn").addEventListener("click", () => abrirForm());

$("#form").addEventListener("submit", async ev => {
  ev.preventDefault();
  const e = ENT[tab], d = {};
  for (const c of e.campos) {
    const el = $(`[name="${c.k}"]`);
    if (!el) continue;
    d[c.k] = c.tipo === "checkbox" ? el.checked : c.tipo === "number" ? Number(el.value) : el.value;
  }
  $("#fOk").disabled = true;
  try {
    if (editando) await (e.editar ? e.editar(editando, d) : API.req("PATCH", `/admin/${e.recurso}/${e.id(editando)}`, d));
    else await API.req("POST", `/admin/${e.recurso}`, d);
    toast(editando ? "✅ Actualizado" : "✅ Agregado");
    cerrarForm(); cargar(true);
  } catch (err) {
    $("#fError").textContent = err.details?.map(x => `${x.campo}: ${x.mensaje}`).join(" · ") || err.message;
  } finally { $("#fOk").disabled = false; }
});

/* ---------- DELETE ---------- */
async function borrar(fila) {
  if (!confirm("¿Eliminar este registro? No se puede deshacer.")) return;
  const e = ENT[tab];
  try {
    await (e.borrar ? e.borrar(fila) : API.req("DELETE", `/admin/${e.recurso}/${e.id(fila)}`));
    toast("🗑 Eliminado"); cargar(true);
  } catch (err) { toast("⚠️ " + err.message); }
}

/* ---------- Sesión y refresco ---------- */
function pintarSesion() {
  const u = API.user;
  $("#loginBox").hidden = Boolean(u);
  $("#app").hidden = !u;
  $("#logoutBtn").hidden = $("#live").hidden = !u;
  clearInterval(timer);
  if (u) {
    pintarTabs(); cargar(true);
    // No se refresca con el formulario abierto ni con la pestaña oculta
    timer = setInterval(() => { if ($("#modal").hidden && !document.hidden) cargar(); }, REFRESCO_MS);
  }
}
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault(); $("#lError").textContent = "";
  try { await API.login({ correo: $("#lCorreo").value.trim(), password: $("#lPass").value }); }
  catch (err) { $("#lError").textContent = err.message; }
});
$("#logoutBtn").addEventListener("click", () => API.logout());
addEventListener("auth-change", pintarSesion);
pintarSesion();
