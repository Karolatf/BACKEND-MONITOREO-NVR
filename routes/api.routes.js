// ── Rutas de la API ───────────────────────────────────────────────────────────
// Define los endpoints HTTP disponibles y los conecta con el controlador.
// Separar rutas de controladores permite mantener el código organizado.
// ─────────────────────────────────────────────────────────────────────────────
import { Router }    from 'express';               // Importar el Router de Express
import { getStatus } from '../controllers/apiController.js'; // Importar controlador

const router = Router(); // Crear instancia del enrutador

// ── GET /api/status ───────────────────────────────────────────────────────────
// Devuelve: estado de NVRs + historial de MySQL + eventos pendientes para alertas
router.get('/status', getStatus); // Asociar la ruta con la función del controlador

export default router; // Exportar el router para usarlo en server.js