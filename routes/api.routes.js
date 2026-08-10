// ── Rutas de la API ───────────────────────────────────────────────────────────
import { Router }                  from 'express';
import { getStatus, getHistorial, exportarHistorial } from '../controllers/apiController.js';
import { requiereAuth }            from '../middleware/authMiddleware.js';
import { requierePermiso }         from '../middleware/permisos.js';

const router = Router();

router.get('/status',    requiereAuth, getStatus);    // Estado en tiempo real de NVRs
router.get('/historial', requiereAuth, getHistorial); // Historial con filtros

// Exportar requiere el permiso "exportar_reportes" (el súper admin siempre
// puede; a un analista o al rol visualización hay que otorgárselo explícitamente
// desde Gestión de Usuarios)
router.get('/historial/exportar', requiereAuth, requierePermiso('exportar_reportes'), exportarHistorial);

export default router;