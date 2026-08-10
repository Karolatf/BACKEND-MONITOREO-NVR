// ── Controlador de autenticación ──────────────────────────────────────────────
import { login, refrescarToken, solicitarRecuperacion, restablecerPassword } from '../services/authService.js';
import { registrarFallo, limpiarIntentos } from '../middleware/rateLimitLogin.js';

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export async function postLogin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
  }

  try {
    const resultado = await login(username.trim().toLowerCase(), password);

    if (!resultado) {
      registrarFallo(req);
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    limpiarIntentos(req);
    res.json(resultado); // { token, usuario }
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
// Respuesta SIEMPRE genérica (exista o no el usuario, tenga o no correo
// registrado) para no revelar qué cuentas existen en el sistema.
export async function postSolicitarRecuperacion(req, res) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Ingresa tu usuario.' });
  }

  try {
    await solicitarRecuperacion(username.trim().toLowerCase());
  } catch (err) {
    console.error('Error al solicitar recuperación:', err.message);
    // No se filtra el error al cliente: seguiría siendo un mensaje genérico
  }

  res.json({
    ok: true,
    mensaje: 'Si el usuario existe y tiene un correo registrado, se envió un código a ese correo.'
  });
}

// ── POST /api/auth/recuperar/restablecer ──────────────────────────────────────
export async function postRestablecerPassword(req, res) {
  const { username, codigo, nuevaPassword } = req.body;

  if (!username || !codigo || !nuevaPassword) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }
  if (nuevaPassword.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const ok = await restablecerPassword(username.trim().toLowerCase(), codigo.trim(), nuevaPassword);
    if (!ok) {
      registrarFallo(req);
      return res.status(400).json({ error: 'Código inválido o expirado.' });
    }
    limpiarIntentos(req);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al restablecer contraseña:', err.message);
    res.status(500).json({ error: 'No se pudo restablecer la contraseña.' });
  }
}