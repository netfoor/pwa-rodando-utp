/* =========================================================
   Rodando UTP · Cliente de la API
   - fetch con manejo uniforme de errores ({error:{code,message}})
   - token JWT guardado en localStorage
   - las respuestas GET se guardan en localStorage: si no hay red
     (o la API está caída) se devuelve la última copia y se avisa
     a la interfaz con el evento "api-status".
   ========================================================= */
const API = (() => {
  const TOKEN_KEY = "ru-token", USER_KEY = "ru-user", CACHE = "ru-cache:";
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } }
  };

  /** Error de la API con código estable (ej. RAITE_LLENO) y detalles de validación. */
  class ApiError extends Error {
    constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
  }

  const state = { stale: false }; // true si la última lectura salió de la caché
  const notify = () => dispatchEvent(new CustomEvent("api-status", { detail: { stale: state.stale } }));

  async function request(method, path, body) {
    const headers = { Accept: "application/json" };
    const token = ls.get(TOKEN_KEY);
    if (token) headers.Authorization = "Bearer " + token;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let res;
    try {
      res = await fetch("/api" + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      // Sin red / servidor caído: solo los GET pueden degradar a la copia guardada.
      if (method === "GET") {
        const copia = ls.get(CACHE + path);
        if (copia) { state.stale = true; notify(); return JSON.parse(copia); }
      }
      state.stale = true; notify();
      throw new ApiError(0, "SIN_CONEXION", "No hay conexión con el servidor");
    }

    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const e = data?.error || {};
      if (res.status === 401 && token) logout(); // sesión vencida
      // Si el servidor responde 5xx en un GET, también se usa la copia guardada.
      if (method === "GET" && res.status >= 500) {
        const copia = ls.get(CACHE + path);
        if (copia) { state.stale = true; notify(); return JSON.parse(copia); }
      }
      throw new ApiError(res.status, e.code || "ERROR", e.message || "Algo salió mal", e.details);
    }
    if (method === "GET") {
      ls.set(CACHE + path, JSON.stringify(data));
      if (state.stale) { state.stale = false; notify(); }
    }
    return data;
  }

  function saveSession({ token, usuario }) {
    ls.set(TOKEN_KEY, token);
    ls.set(USER_KEY, JSON.stringify(usuario));
    dispatchEvent(new CustomEvent("auth-change"));
    return usuario;
  }
  function logout() {
    ls.del(TOKEN_KEY); ls.del(USER_KEY);
    ls.del(CACHE + "/reservas/mias"); // no dejar datos personales en caché compartida
    dispatchEvent(new CustomEvent("auth-change"));
  }

  const qs = obj => {
    const p = new URLSearchParams();
    Object.entries(obj || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && v !== "todos" && v !== "todas") p.set(k, v); });
    const s = p.toString();
    return s ? "?" + s : "";
  };

  return {
    ApiError,
    state,
    get user() { try { return JSON.parse(ls.get(USER_KEY)); } catch { return null; } },
    get token() { return ls.get(TOKEN_KEY); },
    logout,
    /** Petición genérica (la usa el panel de administración). */
    req: request,

    registro: async d => saveSession(await request("POST", "/auth/registro", d)),
    login: async d => saveSession(await request("POST", "/auth/login", d)),
    me: () => request("GET", "/auth/me"),

    zonas: () => request("GET", "/zonas").then(r => r.zonas),
    raites: filtros => request("GET", "/raites" + qs(filtros)).then(r => r.raites),
    testimonios: () => request("GET", "/testimonios").then(r => r.testimonios),
    faq: () => request("GET", "/faq").then(r => r.faq),
    config: () => request("GET", "/config"),
    stats: () => request("GET", "/stats"),

    misRaites: () => request("GET", "/raites/mios").then(r => r.raites),
    crearRaite: d => request("POST", "/raites", d),
    editarRaite: (id, d) => request("PATCH", "/raites/" + id, d),
    eliminarRaite: id => request("DELETE", "/raites/" + id),

    reservar: d => request("POST", "/reservas", d),
    misReservas: () => request("GET", "/reservas/mias").then(r => r.reservas),
    cancelar: codigo => request("DELETE", "/reservas/" + encodeURIComponent(codigo)),

    calculadora: d => request("POST", "/calculadora", d),
    solicitudConductor: d => request("POST", "/conductores/solicitud", d),

    pushKey: () => request("GET", "/push/vapid-public-key"),
    pushSubscribe: sub => request("POST", "/push/subscribe", sub)
  };
})();
