/**
 * Datos de ejemplo del prototipo (zonas, raites, testimonios, FAQ, config).
 * Son los mismos que usaba el frontend estático original en js/data.js.
 */

export const ZONAS = [
  {
    id: "centro", nombre: "Centro Histórico", km: 8, x: 255, y: 235, color: "#FF8A3D",
    lat: 19.0428585, lng: -98.1983825,
    ruta: [[19.042447, -98.198612], [19.04009, -98.194544], [19.040818, -98.19305], [19.041396, -98.192695], [19.036275, -98.182525], [19.040295, -98.180302], [19.043021, -98.180079], [19.043828, -98.17749], [19.044327, -98.171226], [19.046348, -98.165867], [19.048819, -98.163192], [19.054423, -98.159027], [19.057551, -98.156987], [19.060077, -98.156066], [19.059828, -98.154566], [19.058408, -98.154732]],
    trazo: "M255 235 C 300 225, 330 190, 360 175 S 420 150, 440 140"
  },
  {
    id: "amalucan", nombre: "Bosques de Amalucan", km: 5, x: 395, y: 225, color: "#16C47F",
    lat: 19.0679014, lng: -98.1205888,
    ruta: [[19.067902, -98.120589], [19.069311, -98.127142], [19.077448, -98.151115], [19.079432, -98.158325], [19.080044, -98.163271], [19.080501, -98.163614], [19.080968, -98.163333], [19.080727, -98.162576], [19.079581, -98.161943], [19.057724, -98.159367], [19.055894, -98.15814], [19.057551, -98.156987], [19.060077, -98.156066], [19.059828, -98.154566], [19.058408, -98.154732]],
    trazo: "M395 225 C 405 200, 420 170, 440 140"
  },
  {
    id: "xonaca", nombre: "Xonacatepec", km: 9, x: 525, y: 70, color: "#8B5CF6",
    lat: 19.089444, lng: -98.103611,
    ruta: [[19.089445, -98.103613], [19.088921, -98.102493], [19.078282, -98.111203], [19.068831, -98.117272], [19.063269, -98.124355], [19.061801, -98.126892], [19.055585, -98.135581], [19.055763, -98.140795], [19.054917, -98.143203], [19.049247, -98.153506], [19.05419, -98.157214], [19.056862, -98.154909], [19.058408, -98.154732]],
    trazo: "M525 70 C 500 95, 470 110, 440 140"
  },
  {
    id: "amozoc", nombre: "Amozoc", km: 13, x: 545, y: 285, color: "#EF4444",
    lat: 19.0446393, lng: -98.0440666,
    ruta: [[19.044619, -98.043751], [19.041865, -98.043761], [19.042112, -98.050237], [19.043169, -98.053362], [19.045085, -98.061744], [19.044124, -98.073176], [19.043878, -98.082448], [19.04466, -98.091162], [19.044391, -98.097098], [19.046064, -98.104639], [19.046363, -98.111275], [19.046122, -98.113585], [19.046576, -98.115714], [19.045268, -98.119673], [19.044348, -98.12802], [19.041949, -98.139955], [19.041948, -98.148633], [19.04268, -98.148809], [19.05419, -98.157214], [19.056862, -98.154909], [19.058408, -98.154732]],
    trazo: "M545 285 C 520 240, 490 200, 470 175 S 450 150, 440 140"
  },
  {
    id: "cu", nombre: "CU · San Manuel", km: 12, x: 285, y: 335, color: "#0EA5E9",
    lat: 19.0073186, lng: -98.1994816,
    ruta: [[19.007269, -98.199252], [19.005961, -98.199567], [19.004135, -98.194006], [19.007236, -98.194132], [19.016, -98.192535], [19.023625, -98.191746], [19.025695, -98.190163], [19.030635, -98.187424], [19.036275, -98.182525], [19.040295, -98.180302], [19.043021, -98.180079], [19.043828, -98.17749], [19.044327, -98.171226], [19.046348, -98.165867], [19.048819, -98.163192], [19.054423, -98.159027], [19.057551, -98.156987], [19.060077, -98.156066], [19.059828, -98.154566], [19.058408, -98.154732]],
    trazo: "M285 335 C 290 290, 320 260, 350 230 S 410 170, 440 140"
  },
  {
    id: "angelopolis", nombre: "Angelópolis", km: 17, x: 145, y: 355, color: "#EC4899",
    lat: 19.0171709, lng: -98.2523812,
    ruta: [[19.017045, -98.252477], [19.010275, -98.263045], [19.010521, -98.263695], [19.011161, -98.263457], [19.01103, -98.2628], [19.009993, -98.261971], [19.009209, -98.262202], [19.009336, -98.262755], [19.009935, -98.262788], [19.018999, -98.248329], [19.020365, -98.245308], [19.022045, -98.243487], [19.024132, -98.239482], [19.025187, -98.238311], [19.026699, -98.235284], [19.030394, -98.229692], [19.03169, -98.228668], [19.03748, -98.2255], [19.039523, -98.222553], [19.055279, -98.213713], [19.055734, -98.214596], [19.061669, -98.203508], [19.064774, -98.192054], [19.065042, -98.188754], [19.064724, -98.18246], [19.062244, -98.164053], [19.059403, -98.159659], [19.057724, -98.159367], [19.055898, -98.158234], [19.057551, -98.156987], [19.060077, -98.156066], [19.059828, -98.154566], [19.058408, -98.154732]],
    trazo: "M145 355 C 190 320, 230 300, 270 270 S 350 200, 380 175 S 425 148, 440 140"
  },
  {
    id: "cholula", nombre: "Cholula", km: 20, x: 60, y: 245, color: "#F59E0B",
    lat: 19.0678244, lng: -98.3106315,
    ruta: [[19.067412, -98.31084], [19.067044, -98.310024], [19.068633, -98.309212], [19.064685, -98.30031], [19.063203, -98.297167], [19.060535, -98.295647], [19.059673, -98.294029], [19.059747, -98.2354], [19.059483, -98.233946], [19.057888, -98.230193], [19.058361, -98.227908], [19.060232, -98.226872], [19.059037, -98.224285], [19.055064, -98.218634], [19.05538, -98.215301], [19.061847, -98.203058], [19.064287, -98.194307], [19.065018, -98.189845], [19.064724, -98.18246], [19.062263, -98.164111], [19.059403, -98.159659], [19.057724, -98.159367], [19.055892, -98.158203], [19.057551, -98.156987], [19.060077, -98.156066], [19.059828, -98.154566], [19.058408, -98.154732]],
    trazo: "M60 245 C 110 230, 160 225, 210 215 S 330 185, 380 165 S 425 145, 440 140"
  },
  {
    id: "croc", nombre: "CROC · Rivera Anaya", km: 6, x: 300, y: 110, color: "#14B8A6",
    lat: 19.0559038, lng: -98.1470731,
    ruta: [[19.055976, -98.147134], [19.055908, -98.148167], [19.054258, -98.150856], [19.056595, -98.155126], [19.058408, -98.154732]],
    trazo: "M300 110 C 340 105, 390 115, 440 140"
  }
];

// Conductores de ejemplo (clave = correo institucional ficticio)
export const CONDUCTORES = {
  mariana:  { nombre: "Mariana López",     correo: "mariana.lopez@utpuebla.edu.mx",    carrera: "Ing. en Software",              cuatri: 7,  rating: 4.9, viajes: 132, auto: "Nissan March gris" },
  diego:    { nombre: "Diego Hernández",   correo: "diego.hernandez@utpuebla.edu.mx",  carrera: "Mecatrónica",                   cuatri: 4,  rating: 4.7, viajes: 58,  auto: "VW Vento blanco" },
  fernanda: { nombre: "Fernanda Ruiz",     correo: "fernanda.ruiz@utpuebla.edu.mx",    carrera: "Negocios Internacionales",      cuatri: 10, rating: 5.0, viajes: 210, auto: "Chevrolet Aveo rojo" },
  oscar:    { nombre: "Óscar Pérez",       correo: "oscar.perez@utpuebla.edu.mx",      carrera: "Energías Renovables",           cuatri: 7,  rating: 4.8, viajes: 97,  auto: "Toyota Yaris azul" },
  valeria:  { nombre: "Valeria Sánchez",   correo: "valeria.sanchez@utpuebla.edu.mx",  carrera: "Ing. en Software",              cuatri: 10, rating: 4.9, viajes: 164, auto: "Kia Rio negro" },
  rodrigo:  { nombre: "Rodrigo Castillo",  correo: "rodrigo.castillo@utpuebla.edu.mx", carrera: "Mantenimiento Industrial",      cuatri: 7,  rating: 4.6, viajes: 71,  auto: "Mazda 2 plata" },
  andrea:   { nombre: "Andrea Morales",    correo: "andrea.morales@utpuebla.edu.mx",   carrera: "Tecnologías de la Información", cuatri: 4,  rating: 4.8, viajes: 45,  auto: "Honda City blanco" },
  luis:     { nombre: "Luis Ángel Torres", correo: "luis.torres@utpuebla.edu.mx",      carrera: "Mecatrónica",                   cuatri: 1,  rating: 4.5, viajes: 12,  auto: "Nissan Versa gris" },
  sofia:    { nombre: "Sofía Jiménez",     correo: "sofia.jimenez@utpuebla.edu.mx",    carrera: "Procesos Industriales",         cuatri: 4,  rating: 4.9, viajes: 88,  auto: "Seat Ibiza rojo" }
};

// dias: 0 = lunes … 5 = sábado · ocupados = lugares ya apartados por otros estudiantes
export const RAITES = [
  { id: 1,  zona: "centro",      cond: "mariana",  tipo: "ida",     hora: "06:20", dias: [0,1,2,3,4],   asientos: 4, aportacion: 25, ocupados: 2, paradas: ["Zócalo", "Paseo Bravo", "Blvd. 5 de Mayo"] },
  { id: 2,  zona: "centro",      cond: "mariana",  tipo: "regreso", hora: "14:15", dias: [0,1,2,3,4],   asientos: 3, aportacion: 25, ocupados: 1, paradas: ["Blvd. 5 de Mayo", "Paseo Bravo", "Zócalo"] },
  { id: 3,  zona: "amalucan",    cond: "diego",    tipo: "ida",     hora: "06:40", dias: [0,1,2,3,4],   asientos: 3, aportacion: 15, ocupados: 1, paradas: ["Parque Amalucan", "Bosques 1ª secc.", "Blvd. Xonaca"] },
  { id: 4,  zona: "xonaca",      cond: "fernanda", tipo: "ida",     hora: "06:30", dias: [0,1,2,3,4,5], asientos: 4, aportacion: 20, ocupados: 3, paradas: ["Xonacatepec centro", "Autopista (puente)", "San Pablo Xochimehuacan"] },
  { id: 5,  zona: "amozoc",      cond: "oscar",    tipo: "ida",     hora: "06:05", dias: [0,1,2,3,4],   asientos: 4, aportacion: 30, ocupados: 1, paradas: ["Amozoc centro", "Casa Blanca", "Autopista a Orizaba"] },
  { id: 6,  zona: "amozoc",      cond: "oscar",    tipo: "regreso", hora: "20:10", dias: [0,1,2,3,4],   asientos: 4, aportacion: 30, ocupados: 2, paradas: ["Autopista a Orizaba", "Casa Blanca", "Amozoc centro"] },
  { id: 7,  zona: "cu",          cond: "valeria",  tipo: "ida",     hora: "06:10", dias: [0,2,4],       asientos: 3, aportacion: 28, ocupados: 2, paradas: ["CU BUAP", "Plaza San Manuel", "Blvd. Valsequillo"] },
  { id: 8,  zona: "angelopolis", cond: "rodrigo",  tipo: "ida",     hora: "05:55", dias: [0,1,2,3,4],   asientos: 4, aportacion: 35, ocupados: 1, paradas: ["Plaza Angelópolis", "Periférico", "Blvd. Atlixcáyotl"] },
  { id: 9,  zona: "angelopolis", cond: "rodrigo",  tipo: "regreso", hora: "15:00", dias: [0,1,2,3,4],   asientos: 4, aportacion: 35, ocupados: 3, paradas: ["Blvd. Atlixcáyotl", "Periférico", "Plaza Angelópolis"] },
  { id: 10, zona: "cholula",     cond: "andrea",   tipo: "ida",     hora: "05:45", dias: [0,1,2,3,4],   asientos: 3, aportacion: 40, ocupados: 2, paradas: ["Zócalo de Cholula", "Recta a Cholula", "Las Ánimas"] },
  { id: 11, zona: "croc",        cond: "luis",     tipo: "ida",     hora: "06:45", dias: [0,1,2,3,4,5], asientos: 4, aportacion: 12, ocupados: 0, paradas: ["Unidad CROC", "Manuel Rivera Anaya", "Diagonal Defensores"] },
  { id: 12, zona: "croc",        cond: "luis",     tipo: "regreso", hora: "14:05", dias: [0,1,2,3,4],   asientos: 4, aportacion: 12, ocupados: 1, paradas: ["Diagonal Defensores", "Manuel Rivera Anaya", "Unidad CROC"] },
  { id: 13, zona: "centro",      cond: "sofia",    tipo: "ida",     hora: "12:40", dias: [0,1,2,3,4],   asientos: 3, aportacion: 25, ocupados: 1, paradas: ["Los Fuertes", "Blvd. Héroes del 5 de Mayo", "Xonaca"] },
  { id: 14, zona: "xonaca",      cond: "fernanda", tipo: "regreso", hora: "20:15", dias: [0,1,2,3,4],   asientos: 4, aportacion: 20, ocupados: 2, paradas: ["San Pablo Xochimehuacan", "Autopista (puente)", "Xonacatepec centro"] },
  { id: 15, zona: "cu",          cond: "valeria",  tipo: "regreso", hora: "14:30", dias: [0,2,4],       asientos: 3, aportacion: 28, ocupados: 1, paradas: ["Blvd. Valsequillo", "Plaza San Manuel", "CU BUAP"] },
  { id: 16, zona: "amalucan",    cond: "diego",    tipo: "regreso", hora: "19:50", dias: [0,1,2,3,4],   asientos: 3, aportacion: 15, ocupados: 3, paradas: ["Blvd. Xonaca", "Bosques 1ª secc.", "Parque Amalucan"] }
];

export const TESTIMONIOS = [
  { texto: "Antes gastaba casi $900 al mes en gasolina viniendo desde Angelópolis. Ahora llevo a tres compas y me sale en menos de la mitad.", nombre: "Rodrigo C.", rol: "Conductor · Mantenimiento Industrial" },
  { texto: "Tomaba dos combis y un camión. Con Rodando llego en 25 minutos y hasta desayuno tranquila.", nombre: "Karla M.", rol: "Pasajera · Ing. en Software" },
  { texto: "Lo mejor es que solo entran alumnos verificados con correo de la UTP. Mis papás se quedan tranquilos.", nombre: "Paola G.", rol: "Pasajera · Negocios Internacionales" },
  { texto: "Ya hicimos grupo fijo para ir a la estadía. Nos turnamos el coche y cero estrés por el estacionamiento.", nombre: "Jorge L.", rol: "Conductor · Mecatrónica" }
];

// Las respuestas conservan el HTML mínimo (<b>) del index.html original.
export const FAQ = [
  { pregunta: "¿Rodando UTP es un taxi o una app como Uber?", respuesta: "No. Los conductores son estudiantes que <b>ya iban a la UTP</b>. No ganan dinero con los viajes: solo se divide lo que cuesta la gasolina." },
  { pregunta: "¿Cómo se paga la aportación?", respuesta: "En efectivo al subir o por transferencia desde la app. La aportación la sugiere el sistema según los kilómetros de la ruta." },
  { pregunta: "¿Qué pasa si el conductor cancela?", respuesta: "Te llega una notificación y te sugerimos otro raite con el mismo horario. Si alguien cancela seguido, baja su calificación." },
  { pregunta: "¿Puedo usarla sin internet?", respuesta: "Sí. Rodando UTP es una <b>aplicación web progresiva (PWA)</b>: la instalas en tu celular desde el navegador y puedes consultar tus rutas y horarios aunque no tengas datos." },
  { pregunta: "¿Cómo la instalo en mi celular?", respuesta: "En Android toca <b>“Instalar app”</b> arriba o en el menú de Chrome. En iPhone abre Safari, toca <b>Compartir → Agregar a inicio</b>." }
];

export const CONFIG = {
  precioGasolina: 24.3,   // $/litro Magna
  co2PorLitro: 2.31,      // kg de CO₂ por litro
  tarifaUberKm: 9.5,      // $/km
  tarifaUberBase: 35,
  pasajeTransporte: 12,   // $ por camión/combi
  // Cifras base del hero (se les suman los usuarios reales). Se ocultan en GET /api/config.
  stats_estudiantes: 1240,
  stats_conductores: 318,
  stats_co2_toneladas: 46
};
