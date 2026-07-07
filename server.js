// ── Punto de entrada principal del servidor ───────────────────────────────────
import 'dotenv/config';
import express              from 'express';
import { createServer }     from 'http';
import { Server }           from 'socket.io';
import { fileURLToPath }    from 'url';
import { dirname, join }    from 'path';

import { inicializarDB }                                          from './db/init.js';
import { inicializarEstados, sincronizarEstadosDesdeDB, chequearTodo, getUltimoEstado } from './services/monitorService.js';
import apiRoutes                                                  from './routes/api.routes.js';
import authRoutes                                                 from './routes/auth.routes.js';
import { setIO }                                                  from './services/socketService.js';
import { verificarToken }                                         from './services/authService.js';

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
app.use('/api/auth', authRoutes); // Login: pública, sin JWT
app.use('/api', apiRoutes);       // Status/historial: protegidas por JWT

// ── Servidor HTTP + WebSockets (tiempo real) ──────────────────────────────────
// Se envuelve la app de Express en un servidor http nativo porque Socket.IO
// necesita ese servidor para poder "escuchar" conexiones WebSocket además
// de las peticiones HTTP normales.
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// Cada cliente debe mandar su JWT al conectarse (socket.handshake.auth.token).
// Sin un token válido, no se le permite unirse: así nadie recibe datos del
// monitor por WebSocket sin haber iniciado sesión primero.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No autenticado'));
  try {
    socket.usuario = verificarToken(token);
    next();
  } catch {
    next(new Error('Sesión inválida o expirada'));
  }
});

io.on('connection', socket => {
  // Al conectarse, le mandamos el último estado conocido de una vez,
  // para que no tenga que esperar al siguiente chequeo periódico.
  const estado = getUltimoEstado();
  if (estado) socket.emit('estado', estado);
});

setIO(io);

// ── Función de arranque ───────────────────────────────────────────────────────
async function iniciar() {
  try {
    await inicializarDB();
    inicializarEstados();
    await sincronizarEstadosDesdeDB();
    await chequearTodo();

    setInterval(chequearTodo, INTERVALO);

    httpServer.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('Error al iniciar el servidor:', err.message);
    process.exit(1);
  }
}

iniciar();