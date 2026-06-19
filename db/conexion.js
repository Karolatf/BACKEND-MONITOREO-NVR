// ── Módulo de conexión a MySQL ────────────────────────────────────────────────
// Gestiona el pool de conexiones reutilizables a la base de datos.
// El pool evita abrir y cerrar una conexión en cada consulta.
// ─────────────────────────────────────────────────────────────────────────────
import mysql from 'mysql2/promise'; // Importar mysql2 con soporte de promesas (async/await)

let pool = null; // Variable singleton del pool — se crea una sola vez

// ── Crear el pool de conexiones ───────────────────────────────────────────────
export async function crearPool() {
  pool = mysql.createPool({                               // Crear pool con la configuración del .env
    host:               process.env.DB_HOST || 'localhost', // Dirección del servidor MySQL
    user:               process.env.DB_USER || 'root',     // Usuario de MySQL
    password:           process.env.DB_PASS || '',         // Contraseña de MySQL
    database:           process.env.DB_NAME || 'nvr_monitor', // Nombre de la base de datos
    waitForConnections: true,                               // Esperar si no hay conexiones libres
    connectionLimit:    10                                  // Máximo de conexiones simultáneas
  });
  return pool; // Retornar el pool creado
}

// ── Obtener el pool ya creado ─────────────────────────────────────────────────
export function getPool() {
  return pool; // Retornar el pool existente (debe llamarse después de crearPool)
}