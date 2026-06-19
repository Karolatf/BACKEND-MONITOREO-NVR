// ── Inicialización de la conexión a la base de datos ─────────────────────────
// La base de datos, el usuario y la tabla ya fueron creados manualmente
// en MySQL Workbench ejecutando 01_root.sql y 02_schema.sql.
// Este archivo solo inicializa el pool de conexiones y verifica que funcione.
// ─────────────────────────────────────────────────────────────────────────────
import 'dotenv/config';          // Cargar variables del archivo .env
import { crearPool } from './conexion.js'; // Función que crea el pool de conexiones

// ── Función de inicialización ─────────────────────────────────────────────────
export async function inicializarDB() {
  await crearPool();
  console.log('Conectado a la base de datos correctamente');
}