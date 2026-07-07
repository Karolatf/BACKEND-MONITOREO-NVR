// ── Rutas de autenticación ─────────────────────────────────────────────────────
import { Router }            from 'express';
import { postLogin, postRefresh } from '../controllers/authController.js';
import { verificarBloqueo }  from '../middleware/rateLimitLogin.js';
import { requiereAuth }      from '../middleware/authMiddleware.js';

const router = Router();

router.post('/login',   verificarBloqueo, postLogin);
router.post('/refresh', requiereAuth,     postRefresh); // Sesión deslizante

export default router;