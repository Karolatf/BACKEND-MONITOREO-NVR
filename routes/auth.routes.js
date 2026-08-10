// ── Rutas de autenticación ─────────────────────────────────────────────────────
import { Router } from 'express';
import {
  postLogin,
  postRefresh,
  postSolicitarRecuperacion,
  postRestablecerPassword
} from '../controllers/authController.js';
import { verificarBloqueo }  from '../middleware/rateLimitLogin.js';
import { requiereAuth }      from '../middleware/authMiddleware.js';

const router = Router();

router.post('/login',   verificarBloqueo, postLogin);
router.post('/refresh', requiereAuth,     postRefresh); // Sesión deslizante

// Recuperación de contraseña por correo — mismo límite anti fuerza bruta que
// el login, para que nadie pueda usarlo para reventar códigos por prueba y error
router.post('/recuperar/solicitar',   verificarBloqueo, postSolicitarRecuperacion);
router.post('/recuperar/restablecer', verificarBloqueo, postRestablecerPassword);

export default router;