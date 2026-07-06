// ── Rutas de la API ───────────────────────────────────────────────────────────
import { Router }                  from 'express';
import { getStatus, getHistorial } from '../controllers/apiController.js';

const router = Router();

router.get('/status',    getStatus);    // Estado en tiempo real de NVRs
router.get('/historial', getHistorial); // Historial con filtros

export default router;