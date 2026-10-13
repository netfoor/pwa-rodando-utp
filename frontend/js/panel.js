/* =========================================================
   Rodando UTP · Panel del conductor (CRUD de raites)
   Crear (POST), leer (GET), actualizar (PATCH) y eliminar
   (DELETE) sobre /api/raites, con la sesión del usuario.
   ========================================================= */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
let zonas = [], raites = [], editandoId = null;

// Tema guardado desde la página principal
try { const t = JSON.parse(localStorage.getItem("ru-theme")); if (t) document.documentElement.dataset.theme = t; } catch { /* sin tema */ }

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 2800);
}
const zonaNombre = id => zonas.find(z => z.id === id)?.nombre || id;

/* ---------- Vista según sesión ---------- */
function pintarSesion() {
  const u = API.user;
  $("#loginBox").hidden = Boolean(u);
  $("#crud").hidden = !u;
  $("#who").hidden = $("#logoutBtn").hidden = !u;
  if (u) { $("#who").textContent = u.nombre; cargar(); }
}

/* ---------- READ ---------- */
async function cargar() {
  try {
    if (!zonas.length) { zonas = await API.zonas(); llenarZonas(); }
    raites = await API.misRaites();
  } catch (err) {
    toast("⚠️ " + err.message);
    return;
  }
  $("#emptyMsg").hidden = raites.length > 0;
  $("#tbl").hidden = raites.length === 0;
  $("#rows").innerHTML = raites.map(r => `
    <tr class="${r.activo ? "" : "off"}">
      <td data-l="Ruta"><b>${r.tipo === "ida" ? esc(zonaNombre(r.zona)) + " → UTP" : "UTP → " + esc(zonaNombre(r.zona))}</b><small>${esc(r.paradas.join(" · "))}</small></td>
      <td data-l="Hora">${r.hora}</td>
      <td data-l="Días">${r.dias.map(d => DIAS[d]).join(", ")}</td>
      <td data-l="Asientos">${r.asientos}</td>
      <td data-l="Aportación">$${r.aportacion}</td>
      <td data-l="Estado"><span class="pill-s ${r.activo ? "on" : ""}">${r.activo ? "Activo" : "Pausado"}</span></td>
      <td class="acts">
        <button class="btn btn--sm btn--outline" data-edit="${r.id}">✏️ Editar</button>
        <button class="btn btn--sm btn--danger" data-del="${r.id}">🗑 Eliminar</button>
      </td>
    </tr>`).join("");
  $$("[data-edit]").forEach(b => b.addEventListener("click", () => abrirForm(raites.find(r => r.id === +b.dataset.edit))));
  $$("[data-del]").forEach(b => b.addEventListener("click", () => eliminar(raites.find(r => r.id === +b.dataset.del))));
}

/* ---------- Formulario (CREATE / UPDATE) ---------- */
function llenarZonas() {
  $("#fZona").innerHTML = zonas.map(z => `<option value="${esc(z.id)}">${esc(z.nombre)}</option>`).join("");
  $("#fDias").innerHTML = DIAS.map((d, i) => `<button type="button" data-d="${i}">${d}</button>`).join("");
  $$("#fDias button").forEach(b => b.addEventListener("click", () => b.classList.toggle("active")));
}

function abrirForm(r = null) {
  editandoId = r?.id ?? null;
  $("#formTitle").textContent = r ? "Editar raite" : "Agregar raite";
  $("#fZona").value = r?.zona ?? zonas[0]?.id;
  $("#fTipo").value = r?.tipo ?? "ida";
  $("#fHora").value = r?.hora ?? "06:30";
  $("#fAsientos").value = r?.asientos ?? 3;
  $("#fAport").value = r?.aportacion ?? 20;
  $("#fParadas").value = (r?.paradas ?? []).join("\n");
  $("#fActivo").checked = r?.activo ?? true;
  $("#activoWrap").hidden = !r;
  $$("#fDias button").forEach(b => b.classList.toggle("active", (r?.dias ?? [0, 1, 2, 3, 4]).includes(+b.dataset.d)));
  $("#fError").textContent = "";
  $("#modal").hidden = false;
}
const cerrarForm = () => { $("#modal").hidden = true; };
$("#modal").addEventListener("click", e => { if (e.target.closest("[data-close]")) cerrarForm(); });
addEventListener("keydown", e => { if (e.key === "Escape") cerrarForm(); });
$("#newBtn").addEventListener("click", () => abrirForm());

$("#raiteForm").addEventListener("submit", async e => {
  e.preventDefault();
  const datos = {
    zona: $("#fZona").value,
    tipo: $("#fTipo").value,
    hora: $("#fHora").value,
    dias: $$("#fDias button.active").map(b => +b.dataset.d),
    asientos: +$("#fAsientos").value,
    aportacion: +$("#fAport").value,
    paradas: $("#fParadas").value.split("\n").map(s => s.trim()).filter(Boolean)
  };
  if (!datos.dias.length) { $("#fError").textContent = "Elige al menos un día."; return; }
  if (!datos.paradas.length) { $("#fError").textContent = "Escribe al menos una parada."; return; }
  $("#fOk").disabled = true;
  try {
    if (editandoId) { await API.editarRaite(editandoId, { ...datos, activo: $("#fActivo").checked }); toast("✅ Raite actualizado"); }
    else { await API.crearRaite(datos); toast("✅ Raite agregado"); }
    cerrarForm();
    cargar();
  } catch (err) {
    $("#fError").textContent = err.details?.map(d => `${d.campo}: ${d.mensaje}`).join(" · ") || err.message;
  } finally {
    $("#fOk").disabled = false;
  }
});

/* ---------- DELETE ---------- */
async function eliminar(r) {
  if (!confirm(`¿Eliminar el raite de las ${r.hora} (${zonaNombre(r.zona)})? Se cancelarán sus reservaciones.`)) return;
  try { await API.eliminarRaite(r.id); toast("🗑 Raite eliminado"); cargar(); }
  catch (err) { toast("⚠️ " + err.message); }
}

/* ---------- Acceso ---------- */
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  $("#lError").textContent = "";
  try { await API.login({ correo: $("#lCorreo").value.trim(), password: $("#lPass").value }); }
  catch (err) { $("#lError").textContent = err.message; }
});
$("#logoutBtn").addEventListener("click", () => API.logout());
addEventListener("auth-change", pintarSesion);
pintarSesion();
