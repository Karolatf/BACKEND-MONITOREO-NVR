// ── Servicio de gestión de usuarios (exclusivo del súper administrador) ──────
// Reglas de seguridad que se cumplen SIEMPRE, sin excepción:
//   - Nunca se puede crear un segundo "superadmin" desde aquí — esa cuenta
//     solo se crea por consola con scripts/crearAdmin.js.
//   - Nunca se puede editar, cambiarle la contraseña, desactivar ni eliminar
//     a un usuario cuyo rol sea "superadmin".
//   - Los permisos que lleguen desde la web se filtran contra el catálogo
//     oficial (config/permisos.js): un permiso que no exista ahí, se ignora.
//   - Toda contraseña (creación, cambio forzado por el admin) pasa por el
//     mismo validador de fortaleza que usa la recuperación por correo.
//
// Activar/desactivar y eliminar son dos acciones DISTINTAS a propósito:
//   - Desactivar (activo=0): reversible, para vacaciones/licencias. No borra
//     nada — su historial de eventos y su registro siguen intactos.
//   - Eliminar: borra el registro por completo. Para cuando alguien ya no
//     trabaja en el hospital. No se puede deshacer.
// ─────────────────────────────────────────────────────────────────────────────
import { getPool }         from '../db/conexion.js';
import { hashPassword }    from './authService.js';
import { validarFortalezaPassword } from '../utils/validarPassword.js';
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
  const errorPassword = validarFortalezaPassword(password);
  if (errorPassword) throw new Error(errorPassword);

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
  const [rows] = await getPool().query('SELECT id, rol, activo FROM usuarios WHERE id = ?', [id]);
  const usuario = rows[0];
  if (!usuario) throw new Error('Usuario no encontrado.');
  if (usuario.rol === 'superadmin') {
    throw new Error('El súper administrador no se puede modificar desde la web.');
  }
  return usuario;
}

// Mismo formato que ya se exige al crear un usuario nuevo: minúsculas,
// números, punto y guion bajo (ej: "karol.torres").
const PATRON_USERNAME = /^[a-z0-9._]{3,50}$/;

// ── Editar nombre, rol, permisos y opcionalmente el username ─────────────────
// El estado activo/inactivo se maneja aparte (cambiarEstadoUsuario).
// `username` es OPCIONAL: si no viene en la petición (o viene vacío), no se
// toca — el frontend solo lo manda cuando el súper admin lo desbloqueó a
// propósito y efectivamente lo cambió.
export async function actualizarUsuario(id, { username, nombre, rol, permisos }) {
  await obtenerUsuarioEditable(id);

  if (!ROLES_ASIGNABLES.includes(rol)) {
    throw new Error('Rol inválido. Debe ser "analista" o "visualizacion".');
  }
  if (!nombre || !nombre.trim()) {
    throw new Error('El nombre es obligatorio.');
  }

  const permisosLimpios = limpiarPermisos(permisos);

  let usernameNormalizado = null;
  if (username !== undefined && username !== null && username.trim() !== '') {
    usernameNormalizado = username.trim().toLowerCase();

    if (!PATRON_USERNAME.test(usernameNormalizado)) {
      throw new Error('El usuario solo puede tener minúsculas, números, punto y guion bajo (3 a 50 caracteres).');
    }

    const [existentes] = await getPool().query(
      'SELECT id FROM usuarios WHERE username = ? AND id != ?',
      [usernameNormalizado, id]
    );
    if (existentes.length > 0) {
      throw new Error(`Ya existe un usuario con el nombre de usuario "${usernameNormalizado}".`);
    }
  }

  try {
    if (usernameNormalizado) {
      await getPool().execute(
        'UPDATE usuarios SET username = ?, nombre = ?, rol = ?, permisos = ? WHERE id = ?',
        [usernameNormalizado, nombre.trim(), rol, JSON.stringify(permisosLimpios), id]
      );
    } else {
      await getPool().execute(
        'UPDATE usuarios SET nombre = ?, rol = ?, permisos = ? WHERE id = ?',
        [nombre.trim(), rol, JSON.stringify(permisosLimpios), id]
      );
    }
  } catch (err) {
    // Última línea de defensa: la columna username también es UNIQUE en la
    // base de datos, por si dos peticiones llegan al mismo tiempo.
    if (err.code === 'ER_DUP_ENTRY') {
      throw new Error('Ese nombre de usuario ya está en uso por otra persona.');
    }
    throw err;
  }
}

// ── Cambiar la contraseña de un usuario (forzado por el súper admin) ─────────
export async function cambiarPasswordAdmin(id, nuevaPassword) {
  await obtenerUsuarioEditable(id);

  const errorPassword = validarFortalezaPassword(nuevaPassword);
  if (errorPassword) throw new Error(errorPassword);

  const passwordHash = await hashPassword(nuevaPassword);
  await getPool().execute('UPDATE usuarios SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}

// ── Activar / desactivar (reversible — no borra nada) ─────────────────────────
export async function cambiarEstadoUsuario(id, activo) {
  await obtenerUsuarioEditable(id);
  await getPool().execute('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]);
}

// ── Eliminar definitivamente (irreversible — borra el registro completo) ─────
export async function eliminarUsuarioDefinitivamente(id) {
  await obtenerUsuarioEditable(id);
  await getPool().execute('DELETE FROM usuarios WHERE id = ?', [id]);
}