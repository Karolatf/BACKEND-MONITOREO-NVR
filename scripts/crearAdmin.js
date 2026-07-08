// ── Script CLI para crear un administrador del área de redes ─────────────────
// Uso: npm run crear-admin
// Pide usuario, nombre y contraseña por consola, genera el hash bcrypt
// y lo guarda en la tabla `usuarios`.
//
// NOTA: la contraseña se pide de forma VISIBLE (no oculta con asteriscos).
// Se intentó ocultarla con setRawMode, pero en Git Bash de Windows esa
// técnica no es confiable: el Enter a veces llega como "\r\n" junto en un
// solo bloque, y el código lo interpretaba como parte de la contraseña,
// guardando un carácter invisible de más al final sin que se notara —
// causando que el login fallara con "usuario o contraseña incorrectos"
// aunque la contraseña escrita se viera idéntica en pantalla. Mejor
// confiable y visible, que "oculta" y potencialmente corrupta.
// ─────────────────────────────────────────────────────────────────────────────
import 'dotenv/config';
import readline      from 'readline';
import { crearPool } from '../db/conexion.js';
import { hashPassword, buscarUsuarioPorUsername } from '../services/authService.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ── Pregunta simple con readline convertida a Promise ─────────────────────────
// trim() quita cualquier espacio, tabulación o salto de línea invisible que
// se haya colado al copiar/pegar o al presionar Enter en distintas terminales.
function preguntar(texto) {
  return new Promise(resolve => rl.question(texto, respuesta => resolve(respuesta.trim())));
}

async function main() {
  await crearPool();

  console.log('── Crear administrador — NVR Monitor HIC ──\n');

  const username = (await preguntar('Usuario (ej: gerson.paez): ')).toLowerCase();
  if (!username) { console.error('El usuario es obligatorio.'); process.exit(1); }

  const existente = await buscarUsuarioPorUsername(username);
  if (existente) { console.error(`Ya existe un usuario activo con username "${username}".`); process.exit(1); }

  const nombre = await preguntar('Nombre completo: ');
  if (!nombre) { console.error('El nombre es obligatorio.'); process.exit(1); }

  console.log('\n(La contraseña se mostrará en pantalla mientras la escribes — asegúrate de que nadie más esté viendo.)');
  const password = await preguntar('Contraseña (mínimo 8 caracteres): ');
  if (!password || password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const confirmacion = await preguntar('Confirmar contraseña: ');
  if (password !== confirmacion) {
    console.error('Las contraseñas no coinciden.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  await getPoolYGuardar(username, passwordHash, nombre);

  console.log(`\nUsuario "${username}" creado correctamente.`);
  console.log(`Contraseña guardada: "${password}" (${password.length} caracteres) — verifícala antes de cerrar esta ventana.`);
  process.exit(0);
}

async function getPoolYGuardar(username, passwordHash, nombre) {
  const { getPool } = await import('../db/conexion.js');
  await getPool().execute(
    'INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)',
    [username, passwordHash, nombre, 'admin']
  );
}

main().catch(err => {
  console.error('Error al crear el administrador:', err.message);
  process.exit(1);
});