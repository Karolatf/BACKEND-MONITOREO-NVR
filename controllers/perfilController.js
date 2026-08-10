// ── Controlador de "Mi Perfil" ────────────────────────────────────────────────
// Cada usuario logueado gestiona SU PROPIO correo personal aquí — el súper
// administrador no lo pide ni lo carga al crear la cuenta (así se definió
// en el diseño de recuperación de contraseña).
import { getPool } from '../db/conexion.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── GET /api/perfil ───────────────────────────────────────────────────────────
export async function getPerfil(req, res) {
  try {
    const [rows] = await getPool().query(
      'SELECT username, nombre, rol, email_personal FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );
    res.json(rows[0] || {});
  } catch (err) {
    console.error('Error al obtener el perfil:', err.message);
    res.status(500).json({ error: 'No se pudo cargar tu perfil.' });
  }
}

// ── PUT /api/perfil/email ─────────────────────────────────────────────────────
export async function putEmailPerfil(req, res) {
  const email = (req.body.email || '').trim().toLowerCase();

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
  }

  try {
    await getPool().execute(
      'UPDATE usuarios SET email_personal = ? WHERE id = ?',
      [email, req.usuario.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al guardar el correo:', err.message);
    res.status(500).json({ error: 'No se pudo guardar tu correo.' });
  }
}