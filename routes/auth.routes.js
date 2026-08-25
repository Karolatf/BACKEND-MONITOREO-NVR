// ── Rutas de autenticación ─────────────────────────────────────────────────────
import { Router } from 'express';
import {
  postLogin,
  postRefresh,
  postSolicitarRecuperacion,
  postRestablecerPassword,
  getHistorialLogin
} from '../controllers/authController.js';
import { verificarBloqueo, verificarBloqueoRecuperacion } from '../middleware/rateLimitLogin.js';
import { requiereAuth }      from '../middleware/authMiddleware.js';
import { requiereSuperAdmin } from '../middleware/permisos.js';

const router = Router();

router.post('/login',   verificarBloqueo, postLogin);
router.post('/refresh', requiereAuth,     postRefresh);

router.post('/recuperar/solicitar',   verificarBloqueoRecuperacion, postSolicitarRecuperacion);
router.post('/recuperar/restablecer', verificarBloqueoRecuperacion, postRestablecerPassword);

// Historial de "quién entró, desde dónde y cuándo" — solo lo ve el súper admin
router.get('/historial-login', requiereAuth, requiereSuperAdmin, getHistorialLogin);

export default router;