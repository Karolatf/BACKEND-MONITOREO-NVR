// ── Controlador de la API ─────────────────────────────────────────────────────
import {
  getUltimoEstado,
  consumirEventosPendientes,
  obtenerHistorialFiltrado
} from '../services/monitorService.js';

// ── GET /api/status ───────────────────────────────────────────────────────────
export async function getStatus(req, res) {
  const estado = getUltimoEstado();
  if (!estado) {
    return res.json({ inicializando: true, mensaje: 'Ejecutando primer chequeo...' });
  }
  const eventosPendientes = consumirEventosPendientes();
  res.json({ ...estado, eventosPendientes });
}

// ── GET /api/historial ────────────────────────────────────────────────────────
// Params opcionales: desde, hasta (YYYY-MM-DD HH:MM:SS), ip, tipo,
//                    tipoDispositivo, hora (0-23)
export async function getHistorial(req, res) {
  const { desde, hasta, ip, tipo, tipoDispositivo, hora } = req.query;
  const eventos = await obtenerHistorialFiltrado({ desde, hasta, ip, tipo, tipoDispositivo, hora });
  res.json({ eventos, total: eventos.length });
}