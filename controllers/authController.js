// ── Controlador de autenticación ──────────────────────────────────────────────
import { login, refrescarToken }                         from '../services/authService.js';
import { verificarBloqueo, registrarFallo, limpiarIntentos } from '../middleware/rateLimitLogin.js';

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
// mantener la sesión activa mientras el usuario sigue interactuando con
// el dashboard, sin necesidad de volver a pedir usuario y contraseña.
export function postRefresh(req, res) {
  const token = refrescarToken(req.usuario); // req.usuario lo llena requiereAuth
  res.json({ token });
}