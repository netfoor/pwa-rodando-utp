/**
 * Datos de ejemplo del prototipo (zonas, raites, testimonios, FAQ, config).
 * Son los mismos que usaba el frontend estático original en js/data.js.
 */

export const ZONAS = [
  { id: "centro",      nombre: "Centro Histórico",     km: 8,  x: 255, y: 235, color: "#FF8A3D", trazo: "M255 235 C 300 225, 330 190, 360 175 S 420 150, 440 140" },
  { id: "amalucan",    nombre: "Bosques de Amalucan",  km: 5,  x: 395, y: 225, color: "#16C47F", trazo: "M395 225 C 405 200, 420 170, 440 140" },
  { id: "xonaca",      nombre: "Xonacatepec",          km: 9,  x: 525, y: 70,  color: "#8B5CF6", trazo: "M525 70 C 500 95, 470 110, 440 140" },
  { id: "amozoc",      nombre: "Amozoc",               km: 13, x: 545, y: 285, color: "#EF4444", trazo: "M545 285 C 520 240, 490 200, 470 175 S 450 150, 440 140" },
  { id: "cu",          nombre: "CU · San Manuel",      km: 12, x: 285, y: 335, color: "#0EA5E9", trazo: "M285 335 C 290 290, 320 260, 350 230 S 410 170, 440 140" },
  { id: "angelopolis", nombre: "Angelópolis",          km: 17, x: 145, y: 355, color: "#EC4899", trazo: "M145 355 C 190 320, 230 300, 270 270 S 350 200, 380 175 S 425 148, 440 140" },
  { id: "cholula",     nombre: "Cholula",              km: 20, x: 60,  y: 245, color: "#F59E0B", trazo: "M60 245 C 110 230, 160 225, 210 215 S 330 185, 380 165 S 425 145, 440 140" },
  { id: "croc",        nombre: "CROC · Rivera Anaya",  km: 6,  x: 300, y: 110, color: "#14B8A6", trazo: "M300 110 C 340 105, 390 115, 440 140" }
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
