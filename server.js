// ── Punto de entrada principal del servidor ───────────────────────────────────
import 'dotenv/config';
import express              from 'express';
import { fileURLToPath }    from 'url';
import { dirname, join }    from 'path';

import { inicializarDB }                                          from './db/init.js';
import { inicializarEstados, sincronizarEstadosDesdeDB, chequearTodo } from './services/monitorService.js';
import apiRoutes                                                  from './routes/api.routes.js';

// ── Configuración de __dirname para ES modules ────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── Variables de configuración ────────────────────────────────────────────────
const app       = express();
const PORT      = process.env.PORT || 3000;
const INTERVALO = (parseInt(process.env.INTERVALO_SEGUNDOS) || 20) * 1000;

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// ── Archivos estáticos del frontend ──────────────────────────────────────────
app.use(express.static(join(__dirname, '..', 'FRONTEND', 'public')));

// ── Rutas de la API ───────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── Función de arranque ───────────────────────────────────────────────────────
async function iniciar() {
  try {
    await inicializarDB();
    inicializarEstados();
    await sincronizarEstadosDesdeDB();
    await chequearTodo();

    setInterval(chequearTodo, INTERVALO);

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('Error al iniciar el servidor:', err.message);
    process.exit(1);
  }
}

iniciar();