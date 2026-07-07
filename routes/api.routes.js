// ── Rutas de la API ───────────────────────────────────────────────────────────
import { Router }                  from 'express';
import { getStatus, getHistorial } from '../controllers/apiController.js';
import { requiereAuth }            from '../middleware/authMiddleware.js';

const router = Router();

router.get('/status',    requiereAuth, getStatus);    // Estado en tiempo real de NVRs
router.get('/historial', requiereAuth, getHistorial); // Historial con filtros

export default router;