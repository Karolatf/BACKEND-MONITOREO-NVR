// ── Limitador de intentos fallidos (fuerza bruta) ─────────────────────────────
// Antes había un único limitador compartido entre login y recuperación de
// contraseña, con la misma clave `${ip}:${username}` — así que un usuario
// bloqueado por fallar el login quedaba también bloqueado para pedir el
// código de recuperación por correo, sin poder salir sin esperar el tiempo
// completo. Ahora cada flujo tiene su propio balde, totalmente independiente.

function crearLimitador({ maxIntentos = 5, ventanaBloqueoMs = 10 * 60 * 1000 } = {}) {
  const intentos = new Map(); // clave: `${ip}:${username}` -> { fallos, bloqueadoHasta }

  function obtenerClave(req) {
    const ip       = req.ip || req.socket?.remoteAddress || 'desconocida';
    const username = (req.body?.username || '').toLowerCase().trim();
    return `${ip}:${username}`;
  }

  function verificarBloqueo(req, res, next) {
    const clave    = obtenerClave(req);
    const registro = intentos.get(clave);

    if (registro && registro.bloqueadoHasta && Date.now() < registro.bloqueadoHasta) {
      const minutosRestantes = Math.ceil((registro.bloqueadoHasta - Date.now()) / 60000);
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutosRestantes} minuto(s).`
      });
    }

    next();
  }

  function registrarFallo(req) {
    const clave    = obtenerClave(req);
    const registro = intentos.get(clave) || { fallos: 0, bloqueadoHasta: null };
    registro.fallos += 1;

    if (registro.fallos >= maxIntentos) {
      registro.bloqueadoHasta = Date.now() + ventanaBloqueoMs;
      registro.fallos = 0;
    }

    intentos.set(clave, registro);
  }

  function limpiarIntentos(req) {
    intentos.delete(obtenerClave(req));
  }

  return { verificarBloqueo, registrarFallo, limpiarIntentos };
}

// ── Instancia para el login ────────────────────────────────────────────────────
const limitadorLogin = crearLimitador({ maxIntentos: 5, ventanaBloqueoMs: 10 * 60 * 1000 });
export const verificarBloqueo = limitadorLogin.verificarBloqueo;
export const registrarFallo   = limitadorLogin.registrarFallo;
export const limpiarIntentos  = limitadorLogin.limpiarIntentos;

// ── Instancia aparte para recuperación (solicitar código + restablecer) ────────
// Comparten balde entre sí (es el mismo flujo), pero nunca con el login.
const limitadorRecuperacion = crearLimitador({ maxIntentos: 5, ventanaBloqueoMs: 10 * 60 * 1000 });
export const verificarBloqueoRecuperacion = limitadorRecuperacion.verificarBloqueo;
export const registrarFalloRecuperacion   = limitadorRecuperacion.registrarFallo;
export const limpiarIntentosRecuperacion  = limitadorRecuperacion.limpiarIntentos;