// ── Rutas de gestión de usuarios ──────────────────────────────────────────────
import { Router } from 'express';
import { requiereAuth }      from '../middleware/authMiddleware.js';
import { requiereSuperAdmin } from '../middleware/permisos.js';
import { PERMISOS_DISPONIBLES } from '../config/permisos.js';
import {
  getUsuarios,
  postUsuario,
  putUsuario,
  putPasswordUsuario,
  putEstadoUsuario,
  deleteUsuario
} from '../controllers/usuariosController.js';

const router = Router();

// Catálogo de permisos: cualquier usuario logueado lo puede consultar (no es
// sensible saber los NOMBRES de los permisos, solo asignarlos sí lo es) —
// Mi Perfil lo usa para mostrar los permisos propios con su nombre legible.
// Por eso va ANTES del router.use(requiereSuperAdmin) de abajo.
router.get('/permisos-disponibles', requiereAuth, (req, res) => res.json(PERMISOS_DISPONIBLES));

// Todo lo demás de este archivo exige sesión activa Y rol superadmin
router.use(requiereAuth, requiereSuperAdmin);

router.get('/',              getUsuarios);
router.post('/',             postUsuario);
router.put('/:id',           putUsuario);
router.put('/:id/password',  putPasswordUsuario);
router.put('/:id/estado',    putEstadoUsuario);
router.delete('/:id',        deleteUsuario);

export default router;