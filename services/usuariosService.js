// ── Servicio de gestión de usuarios (exclusivo del súper administrador) ──────
// Reglas de seguridad que se cumplen SIEMPRE, sin excepción:
//   - Nunca se puede crear un segundo "superadmin" desde aquí — esa cuenta
//     solo se crea por consola con scripts/crearAdmin.js.
//   - Nunca se puede editar, cambiarle la contraseña, ni desactivar a un
//     usuario cuyo rol sea "superadmin", ni siquiera al propio súper admin
//     operando sobre sí mismo por error.
//   - Los permisos que lleguen desde la web se filtran contra el catálogo
//     oficial (config/permisos.js): un permiso que no exista ahí, se ignora.
// ─────────────────────────────────────────────────────────────────────────────
import { getPool }         from '../db/conexion.js';
import { hashPassword }    from './authService.js';
import { CLAVES_PERMISOS_VALIDAS, ROLES_ASIGNABLES } from '../config/permisos.js';

function limpiarPermisos(permisos) {
  if (!Array.isArray(permisos)) return [];
  return permisos.filter(p => CLAVES_PERMISOS_VALIDAS.includes(p));
}

// ── Listar todos los usuarios (para la pantalla de gestión) ──────────────────
export async function listarUsuarios() {
  const [rows] = await getPool().query(`
    SELECT id, username, nombre, email_personal, rol, permisos, activo, creado, ultimo_login
    FROM usuarios
    ORDER BY (rol = 'superadmin') DESC, nombre ASC
  `);
  return rows;
}

// ── Crear un usuario nuevo (analista o visualizacion) ─────────────────────────
export async function crearUsuario({ username, nombre, password, rol, permisos }) {
  if (!username || !nombre || !password) {
    throw new Error('Usuario, nombre y contraseña son obligatorios.');
  }
  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }
  if (!ROLES_ASIGNABLES.includes(rol)) {
    throw new Error('Rol inválido. Debe ser "analista" o "visualizacion".');
  }

  const usernameNormalizado = username.trim().toLowerCase();

  const [existentes] = await getPool().query(
    'SELECT id FROM usuarios WHERE username = ?',
    [usernameNormalizado]
  );
  if (existentes.length > 0) {
    throw new Error(`Ya existe un usuario con el nombre de usuario "${usernameNormalizado}".`);
  }

  const passwordHash    = await hashPassword(password);
  const permisosLimpios = limpiarPermisos(permisos);

  const [resultado] = await getPool().execute(
    'INSERT INTO usuarios (username, password_hash, nombre, rol, permisos) VALUES (?, ?, ?, ?, ?)',
    [usernameNormalizado, passwordHash, nombre.trim(), rol, JSON.stringify(permisosLimpios)]
  );

  return { id: resultado.insertId, username: usernameNormalizado, nombre, rol, permisos: permisosLimpios };
}

// ── Verificar que el usuario objetivo exista y no sea el súper admin ─────────
async function obtenerUsuarioEditable(id) {
  const [rows] = await getPool().query('SELECT id, rol FROM usuarios WHERE id = ?', [id]);
  const usuario = rows[0];
  if (!usuario) throw new Error('Usuario no encontrado.');
  if (usuario.rol === 'superadmin') {
    throw new Error('El súper administrador no se puede modificar desde la web.');
  }
  return usuario;
}

// ── Editar nombre, rol, permisos y estado activo/inactivo ────────────────────
export async function actualizarUsuario(id, { nombre, rol, permisos, activo }) {
  await obtenerUsuarioEditable(id);

  if (!ROLES_ASIGNABLES.includes(rol)) {
    throw new Error('Rol inválido. Debe ser "analista" o "visualizacion".');
  }
  if (!nombre || !nombre.trim()) {
    throw new Error('El nombre es obligatorio.');
  }

  const permisosLimpios = limpiarPermisos(permisos);

  await getPool().execute(
    'UPDATE usuarios SET nombre = ?, rol = ?, permisos = ?, activo = ? WHERE id = ?',
    [nombre.trim(), rol, JSON.stringify(permisosLimpios), activo ? 1 : 0, id]
  );
}

// ── Cambiar la contraseña de un usuario (forzado por el súper admin) ─────────
export async function cambiarPasswordAdmin(id, nuevaPassword) {
  await obtenerUsuarioEditable(id);

  if (!nuevaPassword || nuevaPassword.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  const passwordHash = await hashPassword(nuevaPassword);
  await getPool().execute('UPDATE usuarios SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}

// ── Desactivar un usuario (borrado suave: nunca se elimina el registro) ──────
export async function eliminarUsuario(id) {
  await obtenerUsuarioEditable(id);
  await getPool().execute('UPDATE usuarios SET activo = 0 WHERE id = ?', [id]);
}