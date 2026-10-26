(() => {
  const $ = sel => document.querySelector(sel);
  const FECHA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
  const CACHE = "rodando-live-v1";
  const AVISO_KEY = "ru-vivo-aviso";
  const UTP = [19.0583869, -98.1545312];
  const NOMBRE_UTP = "UTP · Puerta principal";

  let estado = null;
  let raiteId = Number(new URLSearchParams(location.search).get("raite")) || null;
  let mapa = null;
  let capaRuta = null;
  let auto = null;
  let autoRumbo = null;
  let watchId = null;
  let ws = null;
  let reintentos = 0;
  let ping = null;
  let ultimoEnvio = 0;
  let ultimoPunto = null;
  let notificado = false;
  let avisoActivo = false;
  let pidiendo = false;

  const el = {
    who: $("#who"), logout: $("#logoutBtn"), sel: $("#raiteSel"), fecha: $("#fechaTxt"),
    badge: $("#liveBadge"), hint: $("#mapHint"), leyendaAuto: $("#lgAuto"),
    etaNum: $("#etaNum"), etaDist: $("#etaDist"), etaLabel: $("#etaLabel"), etaWarn: $("#etaWarn"),
    estadoPill: $("#estadoPill"), lastUpdate: $("#lastUpdate"),
    passBox: $("#passBox"), loginBox: $("#loginBox"), driverBox: $("#driverBox"), solicitudesBox: $("#solicitudesBox"),
    miReserva: $("#miReserva"), miCodigo: $("#miCodigo"), miParada: $("#miParada"),
    solicitarBox: $("#solicitarBox"), paradaSel: $("#paradaSel"), requestBtn: $("#requestBtn"),
    passMsg: $("#passMsg"), notifyBtn: $("#notifyBtn"), avisarBtn: $("#avisarBtn"), cancelarBtn: $("#cancelarBtn"),
    startBtn: $("#startBtn"), stopBtn: $("#stopBtn"), gpsMsg: $("#gpsMsg"), gpsInfo: $("#gpsInfo"),
    reqs: $("#reqs"), reqEmpty: $("#reqEmpty"), reqCount: $("#reqCount"),
    pasos: $("#pasos"), toasts: $("#toasts")
  };

  const usuario = () => API.user;

  const toast = (texto, malo = false) => {
    const t = document.createElement("div");
    t.className = "toast";
    if (malo) t.style.background = "var(--danger)";
    t.textContent = texto;
    el.toasts.append(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 350); }, 4200);
  };

  const hace = fecha => {
    if (!fecha) return "";
    const s = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 1000));
    if (s < 10) return "hace unos segundos";
    if (s < 60) return `hace ${s} s`;
    const m = Math.round(s / 60);
    return m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`;
  };

  const distancia = (a, b) => {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const diaDeHoy = () => (new Date(FECHA + "T12:00:00Z").getUTCDay() + 6) % 7;

  function cabecera() {
    const u = usuario();
    if (u) {
      el.who.hidden = false;
      el.who.textContent = u.nombre || u.correo;
      el.logout.hidden = false;
      el.loginBox.hidden = true;
    } else {
      el.who.hidden = true;
      el.logout.hidden = true;
      el.passBox.hidden = true;
      el.driverBox.hidden = true;
      el.solicitudesBox.hidden = true;
      el.loginBox.hidden = false;
    }
  }

  async function cargarLista() {
    el.fecha.textContent = new Intl.DateTimeFormat("es-MX", {
      weekday: "long", day: "numeric", month: "long", timeZone: "America/Mexico_City"
    }).format(new Date());
    try {
      const raites = await API.raites();
      const dia = diaDeHoy();
      const hoy = raites.filter(r => r.dias.includes(dia));
      const u = usuario();
      if (u) hoy.sort((a, b) => Number(b.conductor.id === u.id) - Number(a.conductor.id === u.id));
      el.sel.innerHTML = "";
      if (!hoy.length) {
        el.sel.innerHTML = '<option value="">Hoy no hay raites publicados</option>';
        el.sel.disabled = true;
        el.etaDist.textContent = "Los domingos no hay raites en el prototipo. Vuelve de lunes a sábado.";
        return;
      }
      el.sel.disabled = false;
      for (const r of hoy) {
        const o = document.createElement("option");
        o.value = r.id;
        o.textContent = `${r.hora} · ${r.zona.replace(/-/g, " ")} · ${r.conductor.nombre}`;
        el.sel.append(o);
      }
      if (!raiteId || !hoy.some(r => r.id === raiteId)) raiteId = hoy[0].id;
      el.sel.value = String(raiteId);
      await cargar();
    } catch {
      el.sel.innerHTML = '<option value="">Sin conexión</option>';
      el.sel.disabled = true;
    }
  }

  async function cargar() {
    if (!raiteId) return;
    try {
      const nuevo = await API.vivo(raiteId, FECHA);
      aplicar(nuevo);
      conectarWS();
      if (estado?.esConductor) cargarSolicitudes();
    } catch (err) {
      const guardada = await leerUltima();
      if (guardada) {
        mostrarMapa();
        pintarAuto(guardada, false);
        el.etaWarn.hidden = false;
        el.etaWarn.textContent = "Sin conexión. Esta es la última posición guardada en este dispositivo.";
        el.badge.className = "vivo-badge off";
        el.badge.textContent = "Sin conexión";
      } else {
        toast(err.message || "No se pudo cargar el viaje", true);
      }
    }
  }

  function aplicar(e) {
    if (!e) return;
    if (estado && estado.raite.id !== e.raite.id) {
      auto = null;
      capaRuta = null;
    }
    estado = e;
    cabecera();
    mostrarMapa();
    dibujarRuta();
    pintarAuto(e.posicion);
    pintarEta();
    pintarStops();
    pintarPasajero();
    pintarConductor();
    guardarUltima(e.posicion);
  }

  function mostrarMapa() {
    if (mapa) return;
    if (!window.L) {
      el.hint.hidden = false;
      return;
    }
    mapa = L.map("vivoMap", { zoomControl: true, scrollWheelZoom: false }).setView(UTP, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapa);
  }

  const puntoEnRuta = (ruta, f) => {
    if (!ruta?.length) return null;
    const acum = [0];
    for (let i = 1; i < ruta.length; i++) acum.push(acum[i - 1] + distancia(ruta[i - 1], ruta[i]));
    const total = acum[acum.length - 1];
    const s = Math.min(Math.max(f, 0), 1) * total;
    for (let i = 1; i < ruta.length; i++) {
      if (acum[i] >= s) {
        const t = (s - acum[i - 1]) / (acum[i] - acum[i - 1] || 1);
        return [ruta[i - 1][0] + (ruta[i][0] - ruta[i - 1][0]) * t, ruta[i - 1][1] + (ruta[i][1] - ruta[i - 1][1]) * t];
      }
    }
    return ruta[ruta.length - 1];
  };

  function dibujarRuta() {
    if (!mapa || !estado?.ruta?.length) return;
    if (!capaRuta) {
      capaRuta = L.layerGroup().addTo(mapa);
      L.polyline(estado.ruta, { color: "#fff", weight: 10, opacity: .9, lineJoin: "round" }).addTo(capaRuta);
      L.polyline(estado.ruta, { color: "#7C3AED", weight: 5, opacity: .95, lineJoin: "round" }).addTo(capaRuta);
      capaRuta.addLayer(L.circleMarker(estado.origen, {
        radius: 8, color: "#7C3AED", weight: 3, fillColor: "#fff", fillOpacity: 1
      }).bindTooltip("Salida", { direction: "top" }));
      const paradas = estado.raite.paradas;
      paradas.forEach((nombre, i) => {
        const p = puntoEnRuta(estado.ruta, (i + 1) / (paradas.length + 1));
        if (!p) return;
        capaRuta.addLayer(L.marker(p, {
          icon: L.divIcon({ className: "", html: `<span class="stop-pin">${i + 1}</span>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
          keyboard: false, alt: `Parada ${nombre}`
        }).bindTooltip(nombre, { direction: "top" }));
      });
      capaRuta.addLayer(L.marker(estado.campus, {
        icon: L.divIcon({ className: "", html: '<span class="campus-pin">U</span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
        keyboard: false, alt: "UTP"
      }).bindTooltip("UTP · Puerta principal", { direction: "top" }));
      const b = L.latLngBounds([...estado.ruta, estado.campus]);
      mapa.fitBounds(b, { padding: [34, 34] });
    }
  }

  const iconoAuto = rumbo => L.divIcon({
    className: "",
    html: `<span class="car-pin"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style="transform:rotate(${Number(rumbo) || 0}deg)">
      <path d="M12 2 19 21l-7-4-7 4L12 2Z" fill="currentColor"/></svg></span>`,
    iconSize: [38, 38], iconAnchor: [19, 19]
  });

  function pintarAuto(pos, vigente = true) {
    el.leyendaAuto.hidden = !pos;
    el.etaWarn.hidden = true;
    if (!mapa || !pos) {
      if (auto) { auto.remove(); auto = null; }
      return;
    }
    const frio = pos.vigente === false || !vigente;
    if (!auto) {
      auto = L.marker([pos.lat, pos.lng], { icon: iconoAuto(pos.rumbo), keyboard: false, alt: "Auto del conductor", zIndexOffset: 1000 }).addTo(mapa);
    } else {
      auto.setLatLng([pos.lat, pos.lng]);
      if (autoRumbo !== pos.rumbo) auto.setIcon(iconoAuto(pos.rumbo));
    }
    autoRumbo = pos.rumbo;
    if (auto.getTooltip()) auto.setTooltipContent(`Auto · ${hace(pos.actualizadoEn)}`);
    else auto.bindTooltip(`Auto · ${hace(pos.actualizadoEn)}`, { direction: "top" });
    const pin = auto.getElement()?.querySelector(".car-pin");
    if (pin) pin.classList.toggle("frio", frio);
  }

  function pintarEta() {
    if (!estado) return;
    const p = estado.posicion;
    const nombreEstado = {
      programado: "Programado", en_camino: "En camino", recogiendo: "Recogiendo",
      en_ruta: "En ruta", finalizado: "Terminado"
    }[estado.estadoViaje] || "Programado";

    el.estadoPill.textContent = nombreEstado;
    el.estadoPill.className = "pill-s" + (estado.estadoViaje === "programado" || estado.estadoViaje === "finalizado" ? "" : " live");
    el.lastUpdate.textContent = estado.actualizadoEn ? `Señal ${hace(estado.actualizadoEn)}` : "";

    if (estado.estadoViaje === "finalizado") {
      el.badge.className = "vivo-badge";
      el.badge.textContent = "Viaje terminado";
      el.etaLabel.textContent = "Viaje terminado";
      el.etaNum.textContent = "—";
      el.etaDist.textContent = "El conductor cerró el seguimiento. La posición se borró.";
      return;
    }
    if (!p || !p.vigente) {
      el.badge.className = "vivo-badge " + (estado.estadoViaje === "programado" ? "" : "off");
      el.badge.textContent = estado.estadoViaje === "programado" ? "Sin señal" : "Señal perdida";
      el.etaLabel.textContent = "Llegada estimada";
      el.etaNum.textContent = "—";
      el.etaDist.textContent = estado.estadoViaje === "programado"
        ? `El conductor aún no comparte su ubicación. Sale a las ${estado.raite.hora}.`
        : "La última señal tiene más de 90 segundos. Esperando al conductor.";
      if (p && p.vigente === false) {
        el.etaWarn.hidden = false;
        el.etaWarn.textContent = `Última posición ${hace(p.actualizadoEn)}. La estimación puede estar desactualizada.`;
      }
      return;
    }
    el.badge.className = "vivo-badge on";
    el.badge.textContent = "En vivo";
    const destino = estado.raite.tipo === "regreso" ? estado.raite.zona.nombre : "la UTP";
    el.etaLabel.textContent = estado.miParada ? `Llegada a ${estado.miParada}` : `Llegada a ${destino}`;
    el.etaNum.textContent = p.etaMin ?? "—";
    el.etaDist.textContent = `${p.distanciaKm} km restantes · ${p.velocidad ? Math.round(p.velocidad * 3.6) + " km/h" : "velocidad sin dato"}`;
    if (p.desvio > 250) {
      el.etaWarn.hidden = false;
      el.etaWarn.textContent = "El auto va fuera del trazo registrado. La estimación es aproximada.";
    }
    avisarSiFalta();
  }

  function pintarStops() {
    if (!estado) return;
    const paradas = estado.raite.tipo === "regreso"
      ? [NOMBRE_UTP, ...[...estado.raite.paradas].reverse()]
      : [...estado.raite.paradas, NOMBRE_UTP];
    const avance = estado.posicion?.avance ?? 0;
    const hechas = Math.floor(avance * (paradas.length + 1));
    el.pasos.innerHTML = "";
    [...new Set(paradas)].forEach((nombre, i) => {
      const li = document.createElement("li");
      li.textContent = nombre;
      if (i < hechas) li.className = "done";
      else if (i === hechas) li.className = "next";
      el.pasos.append(li);
    });
  }

  function pintarPasajero() {
    const u = usuario();
    const soyConductor = Boolean(estado?.esConductor);
    el.loginBox.hidden = Boolean(u);
    el.passBox.hidden = !u || soyConductor;
    el.driverBox.hidden = !soyConductor;
    el.solicitudesBox.hidden = !soyConductor;
    if (!u || soyConductor) return;

    const m = estado.miReserva;
    el.miReserva.hidden = !m;
    el.solicitarBox.hidden = Boolean(m);
    el.passMsg.hidden = true;
    el.notifyBtn.hidden = !m || !("Notification" in window);
    if (m) {
      el.miCodigo.textContent = m.codigo;
      el.miParada.textContent = m.estado === "confirmada"
        ? `Confirmado. Te subes en ${m.parada}.`
        : `Solicitud enviada para ${m.parada}. Espera a que el conductor la acepte.`;
      el.avisarBtn.hidden = m.estado !== "confirmada";
      el.notifyBtn.textContent = avisoActivo ? "Aviso de 3 minutos activado" : "Avisarme 3 minutos antes";
      el.notifyBtn.disabled = avisoActivo;
      return;
    }
    const actual = el.paradaSel.value;
    el.paradaSel.innerHTML = "";
    const opciones = estado.raite.tipo === "regreso" ? [NOMBRE_UTP, ...estado.raite.paradas] : [...estado.raite.paradas, NOMBRE_UTP];
    for (const p of [...new Set(opciones)]) {
      const o = document.createElement("option");
      o.value = p;
      o.textContent = p;
      el.paradaSel.append(o);
    }
    if (actual && [...el.paradaSel.options].some(o => o.value === actual)) el.paradaSel.value = actual;
    const libres = estado.raite.libres;
    el.requestBtn.disabled = libres === 0 || estado.estadoViaje === "finalizado";
    el.requestBtn.textContent = libres === 0 ? "Sin lugares disponibles" : "Solicitar lugar";
  }

  function pintarConductor() {
    if (!estado?.esConductor) return;
    const activo = ["en_camino", "recogiendo", "en_ruta"].includes(estado.estadoViaje);
    el.startBtn.textContent = activo ? "Reanudar ubicación" : estado.estadoViaje === "finalizado" ? "Iniciar de nuevo" : "Iniciar y compartir ubicación";
    el.startBtn.hidden = false;
    el.stopBtn.hidden = !activo;
    el.gpsMsg.hidden = false;
    el.gpsMsg.textContent = activo
      ? "El viaje está abierto. Mantén esta página visible: el navegador deja de enviar la ubicación si la cierras."
      : "Comparte tu ubicación solo mientras el viaje está activo. La posición se borra al terminar y solo la ven los participantes.";
  }

  async function cargarSolicitudes() {
    if (!estado?.esConductor) return;
    try {
      const lista = await API.vivoSolicitudes(raiteId, FECHA);
      renderSolicitudes(lista);
    } catch { /* el estado ya muestra el error principal */ }
  }

  function renderSolicitudes(lista) {
    el.reqs.innerHTML = "";
    el.reqCount.textContent = lista.length;
    el.reqEmpty.hidden = lista.length > 0;
    for (const s of lista) {
      const caja = document.createElement("div");
      caja.className = "vivo-req";
      const top = document.createElement("div");
      top.className = "vivo-req__top";
      const nombre = document.createElement("b");
      nombre.textContent = s.nombre || "Pasajero";
      const eta = document.createElement("span");
      eta.textContent = s.etaMin ? `llega en ${s.etaMin} min` : "sin señal";
      top.append(nombre, eta);
      const info = document.createElement("p");
      info.textContent = `${s.parada} · ${s.distanciaKm} km · ${s.codigo}`;
      const acts = document.createElement("div");
      acts.className = "vivo-req__acts";
      const ok = document.createElement("button");
      ok.className = "btn btn--primary btn--sm";
      ok.type = "button";
      ok.dataset.codigo = s.codigo;
      ok.dataset.accion = "aceptar";
      ok.textContent = "Aceptar";
      const no = document.createElement("button");
      no.className = "btn btn--outline btn--sm";
      no.type = "button";
      no.dataset.codigo = s.codigo;
      no.dataset.accion = "rechazar";
      no.textContent = "Rechazar";
      acts.append(ok, no);
      caja.append(top, info, acts);
      el.reqs.append(caja);
    }
  }

  async function solicitar() {
    if (!usuario()) { location.href = "panel.html"; return; }
    const parada = el.paradaSel.value;
    if (!parada) return toast("Elige dónde te subes", true);
    el.requestBtn.disabled = true;
    el.requestBtn.textContent = "Enviando…";
    try {
      await API.vivoSolicitar(raiteId, { parada, fecha: FECHA, nombre: API.user?.nombre });
      toast("Solicitud enviada. El conductor decide si hay lugar.");
      await cargar();
      suscribirWS();
    } catch (err) {
      toast(err.message || "No se pudo enviar la solicitud", true);
      el.requestBtn.disabled = false;
      el.requestBtn.textContent = "Solicitar lugar";
    }
  }

  async function responder(ev) {
    const btn = ev.target.closest("button[data-codigo]");
    if (!btn) return;
    btn.disabled = true;
    try {
      await API.vivoResponder(raiteId, btn.dataset.codigo, btn.dataset.accion, FECHA);
      toast(btn.dataset.accion === "aceptar" ? "Solicitud aceptada" : "Solicitud rechazada");
      await Promise.all([cargar(), cargarSolicitudes()]);
    } catch (err) {
      toast(err.message || "No se pudo responder", true);
      btn.disabled = false;
    }
  }

  async function cancelar() {
    const codigo = estado?.miReserva?.codigo;
    if (!codigo) return;
    el.cancelarBtn.disabled = true;
    try {
      await API.cancelar(codigo);
      toast("Reserva cancelada");
      await cargar();
    } catch (err) {
      toast(err.message || "No se pudo cancelar", true);
    } finally {
      el.cancelarBtn.disabled = false;
    }
  }

  async function avisar() {
    el.avisarBtn.disabled = true;
    try {
      const r = await API.vivoAvisar(raiteId);
      toast(`Aviso enviado: ya esperas en ${r.parada}`);
    } catch (err) {
      toast(err.message || "No se pudo avisar", true);
    } finally {
      el.avisarBtn.disabled = false;
    }
  }

  async function activarAviso() {
    if (!("Notification" in window)) return;
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") return toast("Sin permiso de notificaciones no podemos avisarte", true);
      avisoActivo = true;
      localStorage.setItem(AVISO_KEY, "1");
      el.notifyBtn.textContent = "Aviso de 3 minutos activado";
      el.notifyBtn.disabled = true;
      toast("Te avisamos cuando el auto esté a 3 minutos.");
      avisarSiFalta();
    } catch {
      toast("Este navegador no permite pedir notificaciones desde aquí", true);
    }
  }

  async function avisarSiFalta() {
    if (!avisoActivo || notificado || !estado?.miReserva) return;
    const eta = estado.posicion?.etaMin;
    if (!eta || eta > 3 || !estado.posicion.vigente) return;
    notificado = true;
    const titulo = "Tu raite está por llegar";
    const cuerpo = `${estado.raite.conductor.auto} llega en ${eta} min a ${estado.miReserva.parada}.`;
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg?.showNotification) {
        reg.showNotification(titulo, {
          body: cuerpo, icon: "./img/icons/icon-192.png", tag: `vivo-${raiteId}-${FECHA}`, data: { url: `/vivo.html?raite=${raiteId}` }
        });
      } else {
        new Notification(titulo, { body: cuerpo, icon: "./img/icons/icon-192.png" });
      }
    } catch { /* sin permiso o sin soporte */ }
  }

  async function iniciar() {
    if (pidiendo) return;
    if (!navigator.geolocation) return toast("Este navegador no puede compartir la ubicación", true);
    if (!window.isSecureContext) return toast("La ubicación solo funciona sobre HTTPS o en localhost", true);
    pidiendo = true;
    el.startBtn.disabled = true;
    try {
      await new Promise((ok, falla) => navigator.geolocation.getCurrentPosition(ok, falla, {
        enableHighAccuracy: true, timeout: 15000, maximumAge: 4000
      }));
      await API.vivoIniciar(raiteId, FECHA);
      vigilar();
      el.gpsMsg.textContent = "Compartiendo ubicación. No cierres esta página.";
      toast("Ubicación en vivo activada");
      await cargar();
    } catch (err) {
      const permiso = err?.code === 1;
      toast(permiso ? "Permiso de ubicación denegado. Actívalo en el navegador para compartir." : (err.message || "No se pudo iniciar el viaje"), true);
    } finally {
      pidiendo = false;
      el.startBtn.disabled = false;
    }
  }

  function vigilar() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(enviarPosicion, fallaGps, {
      enableHighAccuracy: true, maximumAge: 5000, timeout: 20000
    });
  }

  function detener() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    el.gpsInfo.hidden = true;
  }

  function fallaGps(err) {
    el.gpsInfo.hidden = false;
    el.gpsInfo.classList.add("bad");
    el.gpsInfo.textContent = err.code === 1
      ? "Permiso de ubicación denegado. El viaje no se está compartiendo."
      : err.code === 3
        ? "El GPS está tardando en responder. Seguimos intentando."
        : "No se pudo leer el GPS. Revisa que la ubicación esté encendida.";
  }

  async function enviarPosicion(pos) {
    if (watchId == null) return;
    const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords;
    if (!Number.isFinite(accuracy) || accuracy > 30) {
      el.gpsInfo.hidden = false;
      el.gpsInfo.classList.add("bad");
      el.gpsInfo.textContent = `Señal imprecisa (±${Math.round(accuracy || 0)} m). Esperando una mejor lectura del GPS.`;
      return;
    }
    const ahora = Date.now();
    if (ultimoPunto && ahora - ultimoEnvio < 5000 && distancia(ultimoPunto, [lat, lng]) < 12) return;

    el.gpsInfo.hidden = false;
    el.gpsInfo.classList.remove("bad");
    el.gpsInfo.textContent = `Enviando: ±${Math.round(accuracy)} m${speed ? ` · ${Math.round(speed * 3.6)} km/h` : ""}`;
    try {
      const r = await API.vivoPosicion(raiteId, {
        lat, lng, precision: Math.round(accuracy),
        velocidad: Number.isFinite(speed) ? Math.round(speed * 10) / 10 : undefined,
        rumbo: Number.isFinite(heading) ? Math.round(heading) : undefined,
        fecha: FECHA
      });
      ultimoEnvio = ahora;
      ultimoPunto = [lat, lng];
      if (estado) {
        estado.posicion = r.posicion;
        estado.estadoViaje = r.viaje.estado;
        estado.actualizadoEn = r.viaje.actualizado_en;
        pintarEta();
        pintarAuto(r.posicion);
        guardarUltima(r.posicion);
      }
      el.gpsInfo.textContent = `Compartiendo · ±${Math.round(accuracy)} m · ${hace(r.viaje.actualizado_en)}`;
    } catch (err) {
      el.gpsInfo.classList.add("bad");
      el.gpsInfo.textContent = err.message || "No se pudo enviar la ubicación";
    }
  }

  async function terminar() {
    el.stopBtn.disabled = true;
    try {
      await API.vivoFinalizar(raiteId, FECHA);
      detener();
      toast("Viaje terminado. La posición se borró.");
      await cargar();
    } catch (err) {
      toast(err.message || "No se pudo terminar el viaje", true);
    } finally {
      el.stopBtn.disabled = false;
    }
  }

  function conectarWS() {
    if (!API.token || !raiteId) return;
    if (ws && ws.readyState <= WebSocket.OPEN) return;
    cerrarWS();
    const proto = location.protocol === "https:" ? "wss" : "ws";
    try {
      ws = new WebSocket(`${proto}://${location.host}/api/vivo/ws?token=${encodeURIComponent(API.token)}`);
    } catch { return; }
    ws.addEventListener("open", () => {
      reintentos = 0;
      suscribirWS();
      clearInterval(ping);
      ping = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ tipo: "ping" }));
      }, 25000);
    });
    ws.addEventListener("message", ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.tipo === "suscrito") {
        if (estado && msg.posicion) {
          estado.posicion = msg.posicion;
          estado.estadoViaje = msg.estado;
          pintarEta();
          pintarAuto(msg.posicion);
        }
      } else if (msg.tipo === "posicion") {
        if (estado) {
          estado.posicion = msg.posicion;
          estado.estadoViaje = msg.estado;
          pintarEta();
          pintarAuto(msg.posicion);
          guardarUltima(msg.posicion);
        }
      } else if (msg.tipo === "estado") {
        if (estado) {
          estado.estadoViaje = msg.estado;
          pintarEta();
          if (msg.estado === "finalizado") { if (watchId != null) detener(); cargar(); }
        }
      } else if (msg.tipo === "finalizado") {
        if (watchId != null) detener();
        cargar();
      } else if (msg.tipo === "solicitudes") {
        if (estado?.esConductor) { cargarSolicitudes(); cargar(); }
      } else if (msg.tipo === "reserva") {
        cargar();
        if (estado?.esConductor) cargarSolicitudes();
      } else if (msg.tipo === "error" && msg.code !== "PROHIBIDO") {
        toast(msg.message || "Error en el canal en vivo", true);
      }
    });
    ws.addEventListener("close", () => {
      ws = null;
      clearInterval(ping);
      if (!API.token) return;
      setTimeout(conectarWS, Math.min(30000, 1000 * 2 ** reintentos++));
    });
  }

  function suscribirWS() {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ tipo: "suscribir", raiteId, fecha: FECHA }));
  }

  function cerrarWS() {
    clearInterval(ping);
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
  }

  async function guardarUltima(pos) {
    if (!pos || !("caches" in window)) return;
    try {
      const c = await caches.open(CACHE);
      await c.put(new Request(`/__vivo/${raiteId}-${FECHA}`), new Response(JSON.stringify(pos), {
        headers: { "Content-Type": "application/json" }
      }));
    } catch { /* almacenamiento lleno o bloqueado */ }
  }

  async function leerUltima() {
    if (!("caches" in window) || !raiteId) return null;
    try {
      const c = await caches.open(CACHE);
      const r = await c.match(new Request(`/__vivo/${raiteId}-${FECHA}`));
      if (!r) return null;
      const p = await r.json();
      const edad = Date.now() - new Date(p.actualizadoEn).getTime();
      return edad < 30 * 60 * 1000 ? { ...p, vigente: false } : null;
    } catch { return null; }
  }

  function reloj() {
    if (!estado?.actualizadoEn) return;
    el.lastUpdate.textContent = `Señal ${hace(estado.actualizadoEn)}`;
    if (auto && auto.getTooltip()) auto.setTooltipContent(`Auto · ${hace(estado.actualizadoEn)}`);
  }

  el.sel.addEventListener("change", () => {
    raiteId = Number(el.sel.value);
    if (!raiteId) return;
    estado = null;
    notificado = false;
    history.replaceState(null, "", `vivo.html?raite=${raiteId}`);
    cerrarWS();
    cargar();
  });
  el.logout.addEventListener("click", () => {
    API.logout();
    detener();
    cerrarWS();
    location.href = "index.html";
  });
  el.requestBtn.addEventListener("click", solicitar);
  el.avisarBtn.addEventListener("click", avisar);
  el.cancelarBtn.addEventListener("click", cancelar);
  el.notifyBtn.addEventListener("click", activarAviso);
  el.startBtn.addEventListener("click", iniciar);
  el.stopBtn.addEventListener("click", terminar);
  el.reqs.addEventListener("click", responder);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) cargar();
  });
  window.addEventListener("online", () => { cargar(); conectarWS(); });
  window.addEventListener("pagehide", () => { cerrarWS(); detener(); });

  avisoActivo = localStorage.getItem(AVISO_KEY) === "1";
  cabecera();
  cargarLista();
  setInterval(reloj, 10000);
  setInterval(() => { if (!document.hidden && raiteId) cargar(); }, 20000);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
