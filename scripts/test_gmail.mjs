// test_gmail.mjs — Prueba aislada de conexión con Gmail
// Lee las credenciales directamente del .env (evita errores de tipeo)
import 'dotenv/config';
import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

console.log('Probando con:');
console.log('  Usuario:', GMAIL_USER);
console.log('  Longitud de la contraseña de app:', GMAIL_APP_PASSWORD?.length, 'caracteres');

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.log('❌ Faltan GMAIL_USER o GMAIL_APP_PASSWORD en el .env');
  process.exit(1);
}

const transportador = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
});

try {
  await transportador.verify();
  console.log('✅ Credenciales aceptadas por Gmail.');
} catch (err) {
  console.log('❌ Gmail rechazó la conexión:', err.message);
}
