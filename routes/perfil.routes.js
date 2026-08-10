// ── Rutas de "Mi Perfil" (cualquier usuario logueado) ─────────────────────────
import { Router } from 'express';
import { requiereAuth } from '../middleware/authMiddleware.js';
import { getPerfil, putEmailPerfil } from '../controllers/perfilController.js';

const router = Router();

router.use(requiereAuth);

router.get('/',       getPerfil);
router.put('/email',  putEmailPerfil);

export default router;