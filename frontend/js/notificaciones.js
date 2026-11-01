/* =========================================================
   Rodando UTP · Laboratorio de notificaciones push
   Permiso → suscripción → envío desde el servidor → aviso
   mostrado por el service worker, con bitácora de eventos.
   ========================================================= */

const $ = (s, c = document) => c.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const HORA = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

try { const t = JSON.parse(localStorage.getItem("ru-theme")); if (t) document.documentElement.dataset.theme = t; } catch { /* sin tema */ }

const soportado = "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
const b64ToBytes = base64 => {
  const plano = atob((base64 + "=".repeat((4 - base64.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(plano, c => c.charCodeAt(0));
};

function toast(texto) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = texto;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 2800);
}

function registrar(texto) {
  $("#logEmpty")?.remove();
  const li = document.createElement("li");
  li.innerHTML = `<time>${HORA.format(new Date())}</time><span>${esc(texto)}</span>`;
  $("#bitacora").appendChild(li);
  $("#bitacora").scrollTop = $("#bitacora").scrollHeight;
}

function mensaje(el, texto, tipo = "") {
  el.textContent = texto;
  el.className = "push-msg" + (tipo ? " " + tipo : "");
  el.hidden = !texto;
}

async function registrarSW() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return null;
  try {
    await navigator.serviceWorker.register("sw.js");
    return await navigator.serviceWorker.ready;
  } catch { return null; }
}

/* ---------------- Estado ---------------- */
async function estado() {
  $("#soportePill").textContent = soportado ? "Compatible" : "Sin soporte";
  $("#soportePill").className = "pill-s " + (soportado ? "live" : "warn");

  $("#stSoporte").textContent = soportado ? "Sí" : "No";
  $("#stSoporte").className = soportado ? "ok" : "bad";

  const permiso = "Notification" in window ? Notification.permission : "no-soportado";
  const nombres = { granted: "Concedido", denied: "Denegado", default: "Sin decidir", "no-soportado": "No disponible" };
  $("#stPermiso").textContent = nombres[permiso] || permiso;
  $("#stPermiso").className = permiso === "granted" ? "ok" : permiso === "denied" ? "bad" : "";

  const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
  $("#stSw").textContent = reg ? "Activo" : "Sin registrar";
  $("#stSw").className = reg ? "ok" : "bad";

  const sub = reg ? await reg.pushManager.getSubscription() : null;
  $("#stSub").textContent = sub ? "Activa" : "Sin suscribir";
  $("#stSub").className = sub ? "ok" : "";
  $("#activarBtn").hidden = Boolean(sub);
  $("#desactivarBtn").hidden = !sub;
  if (sub && permiso === "granted") mensaje($("#subMsg"), "Este navegador ya recibe los avisos de Rodando UTP.", "ok");
  return { reg, sub, permiso };
}

/* ---------------- Suscripción ---------------- */
async function activar() {
  if (!soportado) return mensaje($("#subMsg"), "Este navegador no soporta notificaciones push.", "bad");
  const permiso = await Notification.requestPermission();
  registrar(`Permiso de notificaciones: ${permiso}`);
  if (permiso !== "granted") {
    return mensaje($("#subMsg"), "El permiso quedó denegado. Habilítalo desde el candado de la barra de direcciones.", "bad");
  }

  try {
    const { publicKey } = await API.pushKey();
    const reg = await registrarSW();
    if (!reg) throw new Error("No se pudo registrar el service worker");
    const actual = await reg.pushManager.getSubscription();
    const sub = actual || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
    await API.pushSubscribe(sub.toJSON());
    registrar("Suscripción guardada en el servidor");
    mensaje($("#subMsg"), "Listo. Este navegador recibirá las notificaciones de tu cuenta.", "ok");
    toast("Notificaciones activadas");
  } catch (err) {
    const texto = err.code === "PUSH_NO_CONFIGURADO"
      ? "El servidor todavía no tiene configuradas las llaves VAPID."
      : err.message || "No se pudo activar la suscripción";
    mensaje($("#subMsg"), texto, "bad");
    registrar("Error al suscribir: " + texto);
  }
  await estado();
}

async function desactivar() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) await sub.unsubscribe();
  registrar("Suscripción eliminada de este navegador");
  mensaje($("#subMsg"), "Este navegador ya no recibirá avisos.");
  toast("Notificaciones desactivadas");
  await estado();
}

/* ---------------- Envío de prueba ---------------- */
async function enviar() {
  if (!API.user) return mensaje($("#envioMsg"), "Inicia sesión para enviar la prueba.", "bad");
  const { sub } = await estado();
  if (!sub) return mensaje($("#envioMsg"), "Primero activa las notificaciones en el paso 1.", "bad");

  $("#enviarBtn").disabled = true;
  mensaje($("#envioMsg"), "Enviando…");
  try {
    const r = await API.pushPrueba();
    registrar(`Servidor: ${r.enviados} de ${r.total} envíos aceptados`);
    if (r.enviados) mensaje($("#envioMsg"), "Enviada. El aviso debe aparecer en unos segundos.", "ok");
    else mensaje($("#envioMsg"), "El servidor no encontró una suscripción vigente. Vuelve a activar el paso 1.", "bad");
  } catch (err) {
    const texto = err.code === "PUSH_NO_CONFIGURADO"
      ? "El servidor no tiene llaves VAPID configuradas."
      : err.message || "No se pudo enviar la notificación";
    mensaje($("#envioMsg"), texto, "bad");
    registrar("Error al enviar: " + texto);
  } finally {
    $("#enviarBtn").disabled = false;
  }
}

/* ---------------- Sesión ---------------- */
async function vincularSuscripcion() {
  if (!API.user) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) await API.pushSubscribe(sub.toJSON()).catch(() => {});
}

function pintarSesion() {
  const u = API.user;
  $("#who").hidden = $("#logoutBtn").hidden = !u;
  $("#loginBox").hidden = Boolean(u);
  $("#envioBox").hidden = !u;
  if (u) { $("#who").textContent = u.nombre; registrar(`Sesión iniciada como ${u.nombre}`); }
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  $("#lError").textContent = "";
  try {
    await API.login({ correo: $("#lCorreo").value.trim(), password: $("#lPass").value });
    pintarSesion();
    await vincularSuscripcion();
    toast("Bienvenido");
  } catch (err) {
    $("#lError").textContent = err.message;
  }
});
$("#logoutBtn").addEventListener("click", () => { API.logout(); pintarSesion(); });

/* ---------------- Aviso recibido ---------------- */
function mostrarRecibido(datos) {
  const titulo = datos.titulo || "Rodando UTP";
  const texto = datos.mensaje || "Tienes una novedad en tus raites.";
  $("#ultimaTitulo").textContent = titulo;
  $("#ultimaTexto").textContent = texto;
  $("#ultimaHora").textContent = "Recibida a las " + HORA.format(new Date());
  $("#ultimaNotif").classList.add("nueva");
  setTimeout(() => $("#ultimaNotif").classList.remove("nueva"), 2500);
  registrar(`Push recibido: ${titulo}`);
  toast("🔔 " + titulo);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", e => {
    const d = e.data || {};
    if (d.tipo === "push-recibido") mostrarRecibido(d);
    if (d.irA && !d.tipo) {
      registrar("Notificación abierta");
      if (d.irA.startsWith("/") && !d.irA.startsWith("/#")) location.href = d.irA;
    }
  });
}

$("#activarBtn").addEventListener("click", activar);
$("#desactivarBtn").addEventListener("click", desactivar);
$("#enviarBtn").addEventListener("click", enviar);

(async () => {
  pintarSesion();
  registrar(soportado ? "Navegador compatible con Push API" : "Navegador sin soporte de notificaciones push");
  await registrarSW();
  await vincularSuscripcion();
  await estado();
})();
