// ── Middleware de autenticación JWT ───────────────────────────────────────────
// Protege las rutas de datos (status, historial) exigiendo un token válido
// en el header: Authorization: Bearer <token>
// ─────────────────────────────────────────────────────────────────────────────
import { verificarToken } from '../services/authService.js';

export function requiereAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autenticado. Inicia sesión para continuar.' });
  }

  try {
    req.usuario = verificarToken(token); // Disponible en los controladores si se necesita
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });
  }
}