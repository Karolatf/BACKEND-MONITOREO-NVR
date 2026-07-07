// ── Límite de intentos de login (anti fuerza bruta) ──────────────────────────
// No depende de librerías externas: guarda los intentos fallidos en memoria,
// por combinación de IP + usuario. Tras varios intentos fallidos, bloquea
// temporalmente los siguientes intentos aunque la contraseña sea correcta.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_INTENTOS    = 5;              // Intentos fallidos permitidos
const VENTANA_BLOQUEO = 10 * 60 * 1000; // 10 minutos de bloqueo

const intentos = new Map(); // clave: `${ip}:${username}` -> { fallos, bloqueadoHasta }

function obtenerClave(req) {
  const ip       = req.ip || req.socket?.remoteAddress || 'desconocida';
  const username = (req.body?.username || '').toLowerCase().trim();
  return `${ip}:${username}`;
}

// ── Middleware: se ejecuta ANTES de intentar el login ─────────────────────────
export function verificarBloqueo(req, res, next) {
  const clave  = obtenerClave(req);
  const registro = intentos.get(clave);

  if (registro && registro.bloqueadoHasta && Date.now() < registro.bloqueadoHasta) {
    const minutosRestantes = Math.ceil((registro.bloqueadoHasta - Date.now()) / 60000);
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutosRestantes} minuto(s).`
    });
  }

  next();
}

// ── Registrar un intento fallido ──────────────────────────────────────────────
export function registrarFallo(req) {
  const clave     = obtenerClave(req);
  const registro   = intentos.get(clave) || { fallos: 0, bloqueadoHasta: null };
  registro.fallos += 1;

  if (registro.fallos >= MAX_INTENTOS) {
    registro.bloqueadoHasta = Date.now() + VENTANA_BLOQUEO;
    registro.fallos = 0; // reinicia el conteo tras bloquear
  }

  intentos.set(clave, registro);
}

// ── Limpiar intentos tras un login exitoso ────────────────────────────────────
export function limpiarIntentos(req) {
  intentos.delete(obtenerClave(req));
}