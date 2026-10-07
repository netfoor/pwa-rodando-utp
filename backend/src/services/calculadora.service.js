/**
 * Calculadora de ahorro. Es una función pura portada EXACTAMENTE de calcular()
 * del frontend original: mismas fórmulas para el modo conductor y el pasajero.
 */

const COLORES = { rojo: "#E5484D", naranja: "#FF8A3D", verde: "#16C47F" };

/**
 * @param {{rol:"conductor"|"pasajero", km:number, dias:number, pasajeros?:number, rendimiento?:number, precio?:number}} entrada
 * @param {{precioGasolina:number, co2PorLitro:number, tarifaUberKm:number, tarifaUberBase:number, pasajeTransporte:number}} cfg
 */
export function calcular(entrada, cfg) {
  const { rol, km, dias } = entrada;
  const pas = entrada.pasajeros ?? 3;
  const rend = entrada.rendimiento ?? 14;
  const precio = entrada.precio ?? cfg.precioGasolina;

  const kmMes = km * 2 * dias * 4.3;                       // ida y vuelta, 4.3 semanas
  const litrosMes = kmMes / (rol === "conductor" ? rend : 14);
  const gasMes = litrosMes * precio;

  let ahorro, litrosAhorro, horas, asientos, barras, etiqueta, nota;

  if (rol === "conductor") {
    const tuParte = gasMes / (pas + 1);
    ahorro = gasMes - tuParte;
    litrosAhorro = litrosMes * pas;                        // los compañeros dejan su coche en casa
    asientos = pas * dias * 2 * 4.3;
    barras = [
      { label: "Manejando solo", val: gasMes, color: COLORES.rojo },
      { label: `Con Rodando (${pas + 1} personas)`, val: tuParte, color: COLORES.verde }
    ];
    etiqueta = "Recuperas al mes";
    nota = `Gastas ${dinero(gasMes)} de gasolina al mes. Dividido entre ${pas + 1} personas, a ti solo te toca ${dinero(tuParte)}. Los ${Math.round(litrosAhorro)} L ahorrados salen de los coches que tus compañeros ya no usan.`;
  } else {
    const viajes = dias * 2 * 4.3;
    const uber = viajes * (cfg.tarifaUberBase + km * cfg.tarifaUberKm);
    const camiones = km > 10 ? 3 : 2;
    const transporte = viajes * cfg.pasajeTransporte * camiones;
    const rodando = gasMes / 4;                            // coche con 4 personas
    ahorro = uber - rodando;
    litrosAhorro = litrosMes * 0.75;
    horas = viajes * (km > 10 ? 0.6 : 0.35);
    barras = [
      { label: "Uber / DiDi", val: uber, color: COLORES.rojo },
      { label: `Transporte público (${camiones} camiones)`, val: transporte, color: COLORES.naranja },
      { label: "Rodando UTP", val: rodando, color: COLORES.verde }
    ];
    etiqueta = "Te ahorras al mes (vs. Uber)";
    nota = `Comparado con el transporte público ahorras ${dinero(Math.max(transporte - rodando, 0))} al mes y ${Math.round(horas)} horas de camión.`;
  }

  return {
    rol,
    ahorroMes: ahorro,
    ahorroCuatri: ahorro * 4,
    litros: litrosAhorro,
    co2Kg: litrosAhorro * cfg.co2PorLitro,
    ...(rol === "conductor" ? { asientos } : { horas }),
    barras,
    etiqueta,
    nota
  };
}

// Mismo formato que money() del frontend: $ con separador de miles (es-MX), sin decimales.
const dinero = n => "$" + Math.round(n).toLocaleString("es-MX");
