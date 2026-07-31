// ── Rutas de la API ───────────────────────────────────────────────────────────
import { Router }                  from 'express';
import { getStatus, getHistorial, exportarHistorial } from '../controllers/apiController.js';
import { requiereAuth }            from '../middleware/authMiddleware.js';

const router = Router();

router.get('/status',              requiereAuth, getStatus);    // Estado en tiempo real de NVRs
router.get('/historial',           requiereAuth, getHistorial); // Historial con filtros
router.get('/historial/exportar',  requiereAuth, exportarHistorial); // Exportar Excel/PDF

export default router;