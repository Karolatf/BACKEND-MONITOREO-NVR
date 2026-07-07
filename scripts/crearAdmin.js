// ── Script CLI para crear un administrador del área de redes ─────────────────
// Uso: npm run crear-admin
// Pide usuario, nombre y contraseña por consola, genera el hash bcrypt
// y lo guarda en la tabla `usuarios`. La contraseña NUNCA se guarda en texto
// plano ni queda en el historial de la terminal (se pide con readline oculto).
// ─────────────────────────────────────────────────────────────────────────────
import 'dotenv/config';
import readline      from 'readline';
import { crearPool } from '../db/conexion.js';
import { hashPassword, buscarUsuarioPorUsername } from '../services/authService.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ── Pregunta simple con readline convertida a Promise ─────────────────────────
function preguntar(texto) {
  return new Promise(resolve => rl.question(texto, respuesta => resolve(respuesta.trim())));
}

// ── Pregunta con la entrada oculta (para la contraseña) ───────────────────────
function preguntarOculto(texto) {
  return new Promise(resolve => {
    process.stdout.write(texto);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);
    let entrada = '';

    const onData = char => {
      char = char.toString('utf8');
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(entrada);
      } else if (char === '\u0003') { // Ctrl+C
        process.exit(1);
      } else if (char === '\u007f') { // Backspace
        entrada = entrada.slice(0, -1);
      } else {
        entrada += char;
      }
    };

    stdin.on('data', onData);
  });
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

  const password = await preguntarOculto('Contraseña (mínimo 8 caracteres): ');
  if (!password || password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const confirmacion = await preguntarOculto('Confirmar contraseña: ');
  if (password !== confirmacion) {
    console.error('Las contraseñas no coinciden.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const { getPool }  = await import('../db/conexion.js');

  await getPool().execute(
    'INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)',
    [username, passwordHash, nombre, 'admin']
  );

  console.log(`\nUsuario "${username}" creado correctamente.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error al crear el administrador:', err.message);
  process.exit(1);
});