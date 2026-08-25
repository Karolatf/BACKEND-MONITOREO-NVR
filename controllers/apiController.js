// ── Controlador de la API ─────────────────────────────────────────────────────
import {
  getUltimoEstado,
  consumirEventosPendientes,
  obtenerHistorialFiltrado
} from '../services/monitorService.js';
import { generarExcelHistorial, generarPDFHistorial } from '../services/exportService.js';

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

// ── GET /api/historial/exportar?formato=excel|pdf ─────────────────────────────
// Respeta los mismos filtros que la vista de historial, pero sin el límite de
// 200 filas (hasta 5000, suficiente para cualquier reporte razonable).
export async function exportarHistorial(req, res) {
  const { desde, hasta, ip, tipo, tipoDispositivo, hora, formato } = req.query;

  if (formato !== 'excel' && formato !== 'pdf') {
    return res.status(400).json({ error: 'Formato inválido. Usa formato=excel o formato=pdf.' });
  }

  try {
    const eventos = await obtenerHistorialFiltrado({ desde, hasta, ip, tipo, tipoDispositivo, hora, limite: 5000 });

    const partesFiltro = [];
    if (desde || hasta) partesFiltro.push(`Fecha: ${desde || '...'} a ${hasta || '...'}`);
    if (ip)             partesFiltro.push(`IP/Nombre: ${ip}`);
    if (tipo)           partesFiltro.push(`Tipo: ${tipo === 'caida' ? 'Caída' : 'Recuperación'}`);
    if (tipoDispositivo)partesFiltro.push(`Dispositivo: ${tipoDispositivo === 'nvr' ? 'NVR' : 'Cámara'}`);
    if (hora !== undefined && hora !== '') partesFiltro.push(`Hora: ${hora}:00`);
    const descripcionFiltros = partesFiltro.length > 0 ? partesFiltro.join(' · ') : 'Sin filtros aplicados';

    const fechaArchivo = new Date().toISOString().slice(0, 10);

    if (formato === 'excel') {
      const buffer = await generarExcelHistorial(eventos, descripcionFiltros);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="historial-nvr-${fechaArchivo}.xlsx"`);
      res.send(buffer);
    } else {
      const buffer = await generarPDFHistorial(eventos, descripcionFiltros);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="historial-nvr-${fechaArchivo}.pdf"`);
      res.send(buffer);
    }
  } catch (err) {
    console.error('Error al exportar historial:', err.message);
    res.status(500).json({ error: 'No se pudo generar el archivo de exportación.' });
  }
}