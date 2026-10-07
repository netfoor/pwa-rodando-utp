/**
 * Controlador de catálogo: zonas, testimonios, FAQ, config, stats y calculadora.
 */
import * as cat from "../services/catalogo.service.js";
import { calcular } from "../services/calculadora.service.js";

export const zonas = async (req, res) => res.json({ zonas: await cat.listarZonas() });
export const zona = async (req, res) => res.json(await cat.obtenerZona(req.params.id));
export const testimonios = async (req, res) => res.json({ testimonios: await cat.listarTestimonios() });
export const faq = async (req, res) => res.json({ faq: await cat.listarFaq() });
export const config = async (req, res) => res.json(await cat.obtenerConfig());
export const stats = async (req, res) => res.json(await cat.obtenerStats());
export const calculadora = async (req, res) => res.json(calcular(req.validated.body, await cat.obtenerConfig()));
