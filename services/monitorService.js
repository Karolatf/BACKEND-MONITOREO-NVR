// ── Servicio de monitoreo de NVRs y cámaras ──────────────────────────────────
import { fisica, paciente, cx, ucis } from '../config/dispositivos.js';
import { getPool }                    from '../db/conexion.js';
import { enviarAlerta }               from './telegramService.js';

// ── Estado en memoria ─────────────────────────────────────────────────────────
const estadosNVR    = {}; // { ip: { enCaida: bool, numCaidas: number } }
const estadosCamara = {}; // { ip: { enCaida: bool, nvrNombre: string } }

let ultimoEstado        = null; // Cache del último chequeo para la API
const eventosPendientes = [];   // Cola de eventos nuevos para SweetAlert en el frontend

// ── Inicializar estados en memoria ────────────────────────────────────────────
export function inicializarEstados() {
  const todas = [...fisica, ...paciente, ...cx, ...ucis]; // Unir todas las secciones

  todas.forEach(nvr => {
    estadosNVR[nvr.ip] = { enCaida: false, numCaidas: 0 }; // Estado inicial del NVR
    nvr.camaras.forEach(cam => {
      estadosCamara[cam.ip] = { enCaida: false, nvrNombre: nvr.nombre }; // Estado inicial cámara
    });
  });
}

// ── Sincronizar estados desde la BD al arrancar ───────────────────────────────
// Evita registrar caídas duplicadas cuando el servidor se reinicia.
// Consulta el último evento de cada dispositivo y si fue "caida",
// lo marca como ya caído en memoria para no volver a registrarlo.
export async function sincronizarEstadosDesdeDB() {
  try {
    const pool = getPool(); // Obtener pool de conexiones

    // Obtener el último evento registrado por cada IP
    const [rows] = await pool.query(`
      SELECT ip, tipo
      FROM eventos e1
      WHERE fecha = (
        SELECT MAX(fecha) FROM eventos e2 WHERE e2.ip = e1.ip
      )
    `);

    rows.forEach(row => {
      if (row.tipo === 'caida') {                          // Si el último evento fue una caída
        if (estadosNVR[row.ip])    estadosNVR[row.ip].enCaida    = true; // Marcar NVR como caído
        if (estadosCamara[row.ip]) estadosCamara[row.ip].enCaida = true; // Marcar cámara como caída
      }
    });
  } catch (err) {
    console.error('Error al sincronizar estados:', err.message);
  }
}

// ── Verificar si un dispositivo responde por HTTP ─────────────────────────────
async function verificarDispositivo(ip) {
  const urls = [
    `http://${ip}/`,
    `http://${ip}/favicon.ico`,
    `http://${ip}/doc/page/login.asp`
  ];

  for (const url of urls) {
    try {
      const ctrl = new AbortController();                // Controlador para cancelar la petición
      const t    = setTimeout(() => ctrl.abort(), 3000); // Timeout de 3 segundos
      await fetch(url, { signal: ctrl.signal });         // Intentar conexión HTTP
      clearTimeout(t);
      return true;  // Cualquier respuesta HTTP = dispositivo activo
    } catch { /* Sin respuesta — probar siguiente URL */ }
  }

  return false; // Ninguna URL respondió = dispositivo caído
}

// ── Guardar evento en MySQL ───────────────────────────────────────────────────
async function guardarEvento(nombre, ip, tipo, tipoDispositivo, nvrNombre = null) {
  try {
    await getPool().execute(
      'INSERT INTO eventos (nombre, ip, tipo, tipo_dispositivo, nvr_nombre) VALUES (?, ?, ?, ?, ?)',
      [nombre, ip, tipo, tipoDispositivo, nvrNombre]
    );
  } catch (err) {
    console.error('Error al guardar evento en BD:', err.message);
  }
}

// ── Chequeo completo de todos los NVRs y cámaras ─────────────────────────────
export async function chequearTodo() {
  const secciones = { fisica, paciente, cx, ucis }; // Todas las secciones agrupadas
  const resultado = {};                               // Resultado del chequeo

  await Promise.all(Object.entries(secciones).map(async ([key, lista]) => {
    resultado[key] = await Promise.all(lista.map(async nvr => {

      const activo = await verificarDispositivo(nvr.ip); // Verificar si el NVR responde
      const est    = estadosNVR[nvr.ip];                  // Estado actual en memoria

      // NVR activo -> caido
      if (!activo && !est.enCaida) {
        est.enCaida = true;
        est.numCaidas++;
        const fecha = new Date().toLocaleString('es-CO');
        await guardarEvento(nvr.nombre, nvr.ip, 'caida', 'nvr');
        await enviarAlerta(`NVR CAIDO\nNombre: ${nvr.nombre}\nIP: ${nvr.ip}\nFecha: ${fecha}`);
        eventosPendientes.push({ tipo: 'caida', tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip });
      }

      // NVR caido -> recuperado
      if (activo && est.enCaida) {
        est.enCaida = false;
        const fecha = new Date().toLocaleString('es-CO');
        await guardarEvento(nvr.nombre, nvr.ip, 'recuperacion', 'nvr');
        await enviarAlerta(`NVR RECUPERADO\nNombre: ${nvr.nombre}\nIP: ${nvr.ip}\nFecha: ${fecha}`);
        eventosPendientes.push({ tipo: 'recuperacion', tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip });
      }

      // Chequear cámaras del NVR
      const camaras = await Promise.all(nvr.camaras.map(async cam => {
        const camActiva = await verificarDispositivo(cam.ip); // Verificar si la cámara responde

        if (!estadosCamara[cam.ip]) {
          estadosCamara[cam.ip] = { enCaida: false, nvrNombre: nvr.nombre };
        }
        const camEst = estadosCamara[cam.ip];

        // Camara activa -> caida
        if (!camActiva && !camEst.enCaida) {
          camEst.enCaida = true;
          const fecha = new Date().toLocaleString('es-CO');
          await guardarEvento(cam.nombre, cam.ip, 'caida', 'camara', nvr.nombre);
          await enviarAlerta(`CAMARA CAIDA\nNombre: ${cam.nombre}\nIP: ${cam.ip}\nNVR: ${nvr.nombre}\nFecha: ${fecha}`);
          eventosPendientes.push({ tipo: 'caida', tipoDispositivo: 'camara', nombre: cam.nombre, ip: cam.ip, nvrNombre: nvr.nombre });
        }

        // Camara caida -> recuperada
        if (camActiva && camEst.enCaida) {
          camEst.enCaida = false;
          const fecha = new Date().toLocaleString('es-CO');
          await guardarEvento(cam.nombre, cam.ip, 'recuperacion', 'camara', nvr.nombre);
          await enviarAlerta(`CAMARA RECUPERADA\nNombre: ${cam.nombre}\nIP: ${cam.ip}\nNVR: ${nvr.nombre}\nFecha: ${fecha}`);
          eventosPendientes.push({ tipo: 'recuperacion', tipoDispositivo: 'camara', nombre: cam.nombre, ip: cam.ip, nvrNombre: nvr.nombre });
        }

        return { nombre: cam.nombre, ip: cam.ip, activo: camActiva, enCaida: camEst.enCaida };
      }));

      return { nombre: nvr.nombre, ip: nvr.ip, activo, enCaida: est.enCaida, numCaidas: est.numCaidas, camaras };
    }));
  }));

  ultimoEstado = resultado; // Actualizar cache con el nuevo resultado
}

// ── Obtener historial desde MySQL ─────────────────────────────────────────────
export async function obtenerHistorial() {
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM eventos ORDER BY fecha DESC LIMIT 50'
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener historial:', err.message);
    return [];
  }
}

// ── Getters para la API ───────────────────────────────────────────────────────
export function getUltimoEstado() { return ultimoEstado; }

export function consumirEventosPendientes() {
  const copia = [...eventosPendientes]; // Copiar eventos pendientes
  eventosPendientes.length = 0;         // Limpiar la cola
  return copia;                         // Retornar la copia al frontend
}