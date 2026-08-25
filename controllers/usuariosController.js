// ── Controlador de gestión de usuarios (exclusivo del súper administrador) ───
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarPasswordAdmin,
  cambiarEstadoUsuario,
  eliminarUsuarioDefinitivamente
} from '../services/usuariosService.js';

// ── GET /api/usuarios ─────────────────────────────────────────────────────────
export async function getUsuarios(req, res) {
  try {
    const usuarios = await listarUsuarios();
    res.json(usuarios);
  } catch (err) {
    console.error('Error al listar usuarios:', err.message);
    res.status(500).json({ error: 'No se pudo obtener la lista de usuarios.' });
  }
}

// ── POST /api/usuarios ────────────────────────────────────────────────────────
export async function postUsuario(req, res) {
  try {
    const usuario = await crearUsuario(req.body);
    res.status(201).json(usuario);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── PUT /api/usuarios/:id ─────────────────────────────────────────────────────
export async function putUsuario(req, res) {
  try {
    await actualizarUsuario(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── PUT /api/usuarios/:id/password ────────────────────────────────────────────
export async function putPasswordUsuario(req, res) {
  try {
    await cambiarPasswordAdmin(req.params.id, req.body.password);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── PUT /api/usuarios/:id/estado — activar o desactivar (reversible) ─────────
export async function putEstadoUsuario(req, res) {
  try {
    await cambiarEstadoUsuario(req.params.id, !!req.body.activo);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── DELETE /api/usuarios/:id — elimina el registro por completo ──────────────
export async function deleteUsuario(req, res) {
  try {
    await eliminarUsuarioDefinitivamente(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}