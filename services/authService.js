// ── Servicio de autenticación ─────────────────────────────────────────────────
import bcrypt  from 'bcryptjs';
import jwt     from 'jsonwebtoken';
import crypto  from 'crypto';
import { getPool }                from '../db/conexion.js';
import { enviarCodigoRecuperacion } from './emailService.js';

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
export async function login(username, password) {
  const usuario = await buscarUsuarioPorUsername(username);
  if (!usuario) return null; // Mensaje genérico: no revelamos si el usuario existe

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValida) return null;

  await getPool().execute(
    'UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?',
    [usuario.id]
  );

  const token = generarToken(usuario);

  return {
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
// Siempre "tiene éxito" de cara al usuario, exista o no la cuenta, y tenga o
// no correo registrado — así nadie puede usar este endpoint para averiguar
// qué usuarios existen en el sistema. Si no hay correo registrado, no hay
// nada que enviar y se sale en silencio.
export async function solicitarRecuperacion(username) {
  const usuario = await buscarUsuarioPorUsername(username);
  if (!usuario || !usuario.email_personal) return;

  const codigo     = String(crypto.randomInt(100000, 1000000)); // 6 dígitos
  const codigoHash = await bcrypt.hash(codigo, SALT_ROUNDS);
  const expira     = new Date(Date.now() + MINUTOS_VIGENCIA_CODIGO * 60 * 1000);

  await getPool().execute(
    'UPDATE usuarios SET recuperacion_codigo_hash = ?, recuperacion_expira = ? WHERE id = ?',
    [codigoHash, expira, usuario.id]
  );

  await enviarCodigoRecuperacion(usuario.email_personal, usuario.nombre, codigo);
}

// ── Confirmar el código y establecer la nueva contraseña ─────────────────────
export async function restablecerPassword(username, codigo, nuevaPassword) {
  const usuario = await buscarUsuarioPorUsername(username);
  if (!usuario || !usuario.recuperacion_codigo_hash || !usuario.recuperacion_expira) return false;
  if (new Date(usuario.recuperacion_expira).getTime() < Date.now()) return false;

  const coincide = await bcrypt.compare(codigo, usuario.recuperacion_codigo_hash);
  if (!coincide) return false;

  const passwordHash = await hashPassword(nuevaPassword);
  await getPool().execute(
    'UPDATE usuarios SET password_hash = ?, recuperacion_codigo_hash = NULL, recuperacion_expira = NULL WHERE id = ?',
    [passwordHash, usuario.id]
  );
  return true;
}