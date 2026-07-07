// ── Servicio de autenticación ─────────────────────────────────────────────────
import bcrypt  from 'bcryptjs';
import jwt     from 'jsonwebtoken';
import crypto  from 'crypto';
import { getPool } from '../db/conexion.js';

// El secreto se genera aleatoriamente en cada arranque del servidor (no se lee
// del .env). Esto invalida automáticamente TODAS las sesiones anteriores cada
// vez que el proceso se reinicia (ej: cerrar Git Bash, apagar el servidor,
// reiniciar con nodemon por un cambio de archivo): cualquier token firmado con
// el secreto anterior deja de ser válido y exige volver a iniciar sesión.
const JWT_SECRET     = crypto.randomBytes(48).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '20m';
const SALT_ROUNDS    = 12;

// ── Buscar usuario activo por username ────────────────────────────────────────
export async function buscarUsuarioPorUsername(username) {
  const [rows] = await getPool().query(
    'SELECT * FROM usuarios WHERE username = ? AND activo = 1 LIMIT 1',
    [username]
  );
  return rows[0] || null;
}

// ── Generar un JWT firmado ─────────────────────────────────────────────────────
function generarToken({ id, username, rol }) {
  return jwt.sign({ id, username, rol }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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
    usuario: { id: usuario.id, username: usuario.username, nombre: usuario.nombre, rol: usuario.rol }
  };
}

// ── Reemitir un token nuevo a partir de uno ya válido (sesión deslizante) ─────
// El frontend llama a esto cada pocos minutos mientras hay actividad, para que
// la sesión no expire mientras el usuario sigue trabajando. Si el usuario deja
// de interactuar, el frontend deja de llamarlo y el token expira solo.
export function refrescarToken(usuarioToken) {
  return generarToken(usuarioToken);
}

// ── Generar el hash de una contraseña (usado por scripts/crearAdmin.js) ───────
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// ── Verificar y decodificar un token ──────────────────────────────────────────
export function verificarToken(token) {
  return jwt.verify(token, JWT_SECRET); // Lanza error si es inválido o expiró
}