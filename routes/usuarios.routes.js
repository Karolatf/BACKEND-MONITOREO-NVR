// ── Rutas de gestión de usuarios (exclusivo del súper administrador) ─────────
import { Router } from 'express';
import { requiereAuth }      from '../middleware/authMiddleware.js';
import { requiereSuperAdmin } from '../middleware/permisos.js';
import { PERMISOS_DISPONIBLES } from '../config/permisos.js';
import {
  getUsuarios,
  postUsuario,
  putUsuario,
  putPasswordUsuario,
  deleteUsuario
} from '../controllers/usuariosController.js';

const router = Router();

// Todas las rutas de este archivo exigen sesión activa Y rol superadmin
router.use(requiereAuth, requiereSuperAdmin);

// Catálogo de permisos asignables — el formulario de creación/edición lo
// consulta aquí en vez de tenerlo escrito a mano, así nunca se desactualiza
router.get('/permisos-disponibles', (req, res) => res.json(PERMISOS_DISPONIBLES));

router.get('/',              getUsuarios);
router.post('/',             postUsuario);
router.put('/:id',           putUsuario);
router.put('/:id/password',  putPasswordUsuario);
router.delete('/:id',        deleteUsuario);

export default router;