// ── Servicio de autenticación ─────────────────────────────────────────────────
import bcrypt  from 'bcryptjs';
import jwt     from 'jsonwebtoken';
import crypto  from 'crypto';
import { getPool }                from '../db/conexion.js';
import { enviarCodigoRecuperacion } from './emailService.js';
import { validarFortalezaPassword } from '../utils/validarPassword.js';

// El secreto se genera aleatoriamente en cada arranque del servidor (no se lee
// del .env). Esto invalida automáticamente TODAS las sesiones anteriores cada
// vez que el proceso se reinicia (ej: cerrar Git Bash, apagar el servidor,
// reiniciar con nodemon por un cambio de archivo): cualquier token firmado con
// el secreto anterior deja de ser válido y exige volver a iniciar sesión.
const JWT_SECRET     = crypto.randomBytes(48).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '20m';
const SALT_ROUNDS    = 12;

const MINUTOS_VIGENCIA_CODIGO = 15;

// ── Buscar usuario activo por username ────────────────────────────────────────
export async function buscarUsuarioPorUsername(username) {
  const [rows] = await getPool().query(
    'SELECT * FROM usuarios WHERE username = ? AND activo = 1 LIMIT 1',
    [username]
  );
  return rows[0] || null;
}

// ── Generar un JWT firmado ─────────────────────────────────────────────────────
// Lleva rol y permisos adentro: así, cualquier ruta protegida puede decidir
// si autoriza la acción sin tener que volver a consultar la base de datos en
// cada petición. Si el súper admin le cambia los permisos a alguien, el
// cambio se refleja la próxima vez que ese usuario recibe un token nuevo
// (login, o la sesión deslizante que renueva cada pocos minutos).
function generarToken({ id, username, rol, permisos }) {
  return jwt.sign(
    { id, username, rol, permisos: permisos || [] },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ── Validar credenciales y generar el JWT ─────────────────────────────────────
// Devuelve un motivo específico cuando la cuenta existe, la contraseña es
// correcta, pero está desactivada — para poder mostrar un mensaje distinto en
// el login. OJO: el estado de la cuenta solo se revela DESPUÉS de validar la
// contraseña, nunca antes — así no se puede usar este mensaje para averiguar
// si un usuario existe o está inactivo sin conocer su contraseña.
//
// `ip` es opcional a propósito (ej. llamadas internas o pruebas que no vienen
// de una petición HTTP no deben reventar): si no llega, simplemente no se
// registra en el historial.
export async function login(username, password, ip) {
  const [rows] = await getPool().query(
    'SELECT * FROM usuarios WHERE username = ? LIMIT 1',
    [username]
  );
  const usuario = rows[0];
  if (!usuario) return { ok: false, motivo: 'credenciales' };

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValida) return { ok: false, motivo: 'credenciales' };

  if (!usuario.activo) return { ok: false, motivo: 'inactivo' };

  await getPool().execute(
    'UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?',
    [usuario.id]
  );

  if (ip) await registrarHistorialLogin(usuario.id, usuario.username, ip);

  const token = generarToken(usuario);

  return {
    ok: true,
    token,
    usuario: {
      id: usuario.id,
      username: usuario.username,
      nombre: usuario.nombre,
      rol: usuario.rol,
      permisos: usuario.permisos || []
    }
  };
}

// ── Registrar un inicio de sesión exitoso en el historial ────────────────────
// No debe tumbar el login si falla (ej. la tabla todavía no existe porque no
// se ha corrido la migración): se registra el error y se sigue de largo.
async function registrarHistorialLogin(usuarioId, username, ip) {
  try {
    await getPool().execute(
      'INSERT INTO historial_login (usuario_id, username, ip) VALUES (?, ?, ?)',
      [usuarioId, username, ip]
    );
  } catch (err) {
    console.error('No se pudo registrar el historial de login:', err.message);
  }
}

// ── Historial de inicios de sesión (solo lo consume el súper administrador) ──
export async function obtenerHistorialLogin(limite = 50) {
  const [rows] = await getPool().query(
    'SELECT username, ip, fecha FROM historial_login ORDER BY fecha DESC LIMIT ?',
    [limite]
  );
  return rows;
}

// ── Reemitir un token nuevo a partir de uno ya válido (sesión deslizante) ─────
// El frontend llama a esto cada pocos minutos mientras la pestaña sigue
// abierta, para que la sesión no expire en plena jornada (o, para el rol
// "visualizacion" en el TV, para que nunca expire mientras la pantalla siga
// encendida — ver auth-guard.js en el frontend).
export function refrescarToken(usuarioToken) {
  return generarToken(usuarioToken);
}

// ── Generar el hash de una contraseña ──────────────────────────────────────────
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// ── Verificar y decodificar un token ──────────────────────────────────────────
export function verificarToken(token) {
  return jwt.verify(token, JWT_SECRET); // Lanza error si es inválido o expiró
}

// ── Solicitar un código de recuperación de contraseña ─────────────────────────
// Devuelve el motivo específico si no se pudo enviar (usuario inexistente, o
// existente pero sin correo registrado) para que el frontend le avise a la
// persona en el momento, en vez de dejarla esperando un correo que nunca va
// a llegar. En un sistema interno con una lista corta y conocida de usuarios
// del hospital, esta claridad vale más que ocultar si la cuenta existe.
export async function solicitarRecuperacion(username) {
  const usuario = await buscarUsuarioPorUsername(username);
  if (!usuario) return { ok: false, motivo: 'sin_usuario' };
  if (!usuario.email_personal) return { ok: false, motivo: 'sin_correo' };

  const codigo     = String(crypto.randomInt(100000, 1000000)); // 6 dígitos
  const codigoHash = await bcrypt.hash(codigo, SALT_ROUNDS);
  const expira     = new Date(Date.now() + MINUTOS_VIGENCIA_CODIGO * 60 * 1000);

  await getPool().execute(
    'UPDATE usuarios SET recuperacion_codigo_hash = ?, recuperacion_expira = ? WHERE id = ?',
    [codigoHash, expira, usuario.id]
  );

  await enviarCodigoRecuperacion(usuario.email_personal, usuario.nombre, codigo);
  return { ok: true };
}

// ── Confirmar el código y establecer la nueva contraseña ─────────────────────
export async function restablecerPassword(username, codigo, nuevaPassword) {
  const usuario = await buscarUsuarioPorUsername(username);
  if (!usuario || !usuario.recuperacion_codigo_hash || !usuario.recuperacion_expira) return false;
  if (new Date(usuario.recuperacion_expira).getTime() < Date.now()) return false;

  const coincide = await bcrypt.compare(codigo, usuario.recuperacion_codigo_hash);
  if (!coincide) return false;

  const errorPassword = validarFortalezaPassword(nuevaPassword);
  if (errorPassword) throw new Error(errorPassword);

  const passwordHash = await hashPassword(nuevaPassword);
  await getPool().execute(
    'UPDATE usuarios SET password_hash = ?, recuperacion_codigo_hash = NULL, recuperacion_expira = NULL WHERE id = ?',
    [passwordHash, usuario.id]
  );
  return true;
}