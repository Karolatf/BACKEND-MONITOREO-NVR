// ── Controlador de autenticación ──────────────────────────────────────────────
import { login, refrescarToken, solicitarRecuperacion, restablecerPassword, obtenerHistorialLogin } from '../services/authService.js';
import { registrarFallo, limpiarIntentos, registrarFalloRecuperacion, limpiarIntentosRecuperacion } from '../middleware/rateLimitLogin.js';

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export async function postLogin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
  }

  // Misma forma de obtener la IP que ya usa el limitador de intentos
  // (middleware/rateLimitLogin.js), para que sea consistente en todo el sistema.
  // Node reporta las IPv4 en formato "IPv4-mapped IPv6" (::ffff:127.0.0.1)
  // cuando el servidor escucha en modo dual-stack — es normal y es la IP
  // correcta, pero se ve más claro en el historial sin ese prefijo.
  const ip = limpiarIP(req.ip || req.socket?.remoteAddress || 'desconocida');

  try {
    const resultado = await login(username.trim().toLowerCase(), password, ip);

    if (!resultado.ok) {
      // Cuenta inactiva: la contraseña SÍ era correcta, así que no cuenta
      // como intento fallido (no hay nada que bloquear aquí) y se le explica
      // a la persona qué pasa, en vez del genérico "usuario o contraseña".
      if (resultado.motivo === 'inactivo') {
        return res.status(403).json({
          error: 'Tu cuenta está inactiva. Comunícate con el superadministrador para más información.'
        });
      }

      registrarFallo(req);
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    limpiarIntentos(req);
    res.json({ token: resultado.token, usuario: resultado.usuario });
  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ error: 'Error interno al iniciar sesión.' });
  }
}

// ── POST /api/auth/refresh ─────────────────────────────────────────────────────
// Requiere un token todavía válido (pasa por requiereAuth). Se usa para
// mantener la sesión activa mientras la pestaña sigue abierta, sin necesidad
// de volver a pedir usuario y contraseña.
export function postRefresh(req, res) {
  const token = refrescarToken(req.usuario); // req.usuario lo llena requiereAuth
  res.json({ token });
}

// ── POST /api/auth/recuperar/solicitar ────────────────────────────────────────
export async function postSolicitarRecuperacion(req, res) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Ingresa tu usuario.' });
  }

  try {
    const resultado = await solicitarRecuperacion(username.trim().toLowerCase());

    if (!resultado.ok) {
      const mensaje = resultado.motivo === 'sin_usuario'
        ? 'No existe ningún usuario con ese nombre.'
        : 'Este usuario no tiene un correo personal registrado. Debe registrarlo desde "Mi Perfil" antes de poder recuperar/cambiar la contraseña';
      return res.status(400).json({ error: mensaje });
    }

    res.json({ ok: true, mensaje: 'Se envió un código a tu correo registrado.' });

  } catch (err) {
    console.error('Error al solicitar recuperación:', err.message);
    res.status(500).json({ error: 'No se pudo procesar la solicitud. Intenta de nuevo.' });
  }
}

// ── POST /api/auth/recuperar/restablecer ──────────────────────────────────────
export async function postRestablecerPassword(req, res) {
  const { username, codigo, nuevaPassword } = req.body;

  if (!username || !codigo || !nuevaPassword) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const ok = await restablecerPassword(username.trim().toLowerCase(), codigo.trim(), nuevaPassword);
    if (!ok) {
      registrarFalloRecuperacion(req);
      return res.status(400).json({ error: 'Código inválido o expirado.' });
    }
    limpiarIntentosRecuperacion(req);
    res.json({ ok: true });
  } catch (err) {
    // Errores de validación de contraseña (fortaleza) sí se muestran tal cual —
    // no revelan nada sensible, solo ayudan a corregir la contraseña
    console.error('Error al restablecer contraseña:', err.message);
    res.status(400).json({ error: err.message || 'No se pudo restablecer la contraseña.' });
  }
}

// ── Quitar el prefijo IPv4-mapeado (::ffff:) de una IP, si lo tiene ──────────
function limpiarIP(ip) {
  return ip && ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

// ── GET /api/auth/historial-login ─────────────────────────────────────────────
// Exclusivo del súper administrador (ver auth.routes.js). Se usa en la
// tarjeta "Historial de Inicios de Sesión" de "Mi Perfil".
export async function getHistorialLogin(req, res) {
  try {
    const historial = await obtenerHistorialLogin(50);
    res.json({ historial });
  } catch (err) {
    console.error('Error al obtener el historial de login:', err.message);
    res.status(500).json({ error: 'No se pudo cargar el historial de inicios de sesión.' });
  }
}