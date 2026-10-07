/**
 * Generador de códigos de reservación con formato "RU-XXXX".
 * Excluye caracteres ambiguos (0/O, 1/I) para que sea fácil dictarlo.
 */
import { randomInt } from "node:crypto";

const ALFABETO = "ABCDEFGHJKLMNPQRTUVWXYZ23456789"; // sin S: reservado a datos de ejemplo del seed

/** @returns {string} código como "RU-7KQ2" */
export function generarCodigo() {
  let s = "";
  for (let i = 0; i < 4; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return "RU-" + s;
}
