// ── Controlador de la API ─────────────────────────────────────────────────────
// Maneja las peticiones HTTP y delega la lógica al servicio correspondiente.
// Patrón: Ruta → Controlador → Servicio → Base de datos
// ─────────────────────────────────────────────────────────────────────────────
import {
  getUltimoEstado,          // Obtener el último estado cacheado de los NVRs
  obtenerHistorial,         // Consultar historial de eventos en MySQL
  consumirEventosPendientes // Obtener y vaciar cola de eventos para SweetAlert
} from '../services/monitorService.js'; // Importar funciones del servicio de monitoreo

// ── GET /api/status ───────────────────────────────────────────────────────────
export async function getStatus(req, res) {
  const estado = getUltimoEstado(); // Obtener el último resultado del chequeo

  // Si el primer chequeo aún no ha terminado, informar al cliente
  if (!estado) {
    return res.json({
      inicializando: true,                                    // Indicador de carga inicial
      mensaje:       'Ejecutando primer chequeo, por favor espera...' // Mensaje para mostrar
    });
  }

  const historial         = await obtenerHistorial();      // Últimos 50 eventos de la BD
  const eventosPendientes = consumirEventosPendientes();   // Eventos nuevos para alertas SweetAlert

  // Responder con el estado completo
  res.json({
    ...estado,           // Estado de todos los NVRs: fisica, paciente, cx, ucis
    historial,           // Historial persistido en MySQL (sobrevive reinicios)
    eventosPendientes    // Eventos nuevos para mostrar alertas en el frontend
  });
}