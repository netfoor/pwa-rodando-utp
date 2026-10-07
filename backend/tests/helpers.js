/**
 * Utilidades de prueba: cliente supertest y creación de usuarios únicos.
 */
import request from "supertest";
import { app } from "../src/app.js";

export const api = () => request(app);

let n = 0;
/** Registra un usuario nuevo y devuelve {token, usuario, auth} (auth = cabecera lista para usar). */
export async function nuevoUsuario(extra = {}) {
  const correo = `test.${Date.now()}.${n++}@utpuebla.edu.mx`;
  const res = await api().post("/api/auth/registro").send({ nombre: "Alumno de Prueba", correo, password: "Prueba1234", ...extra });
  if (res.status !== 201) throw new Error("registro falló: " + JSON.stringify(res.body));
  return { ...res.body, auth: { Authorization: `Bearer ${res.body.token}` } };
}

export async function loginAdmin() {
  const res = await api().post("/api/auth/login").send({ correo: "admin@utpuebla.edu.mx", password: "Demo1234!" });
  return { Authorization: `Bearer ${res.body.token}` };
}
