// ── Servicio de monitoreo de NVRs y cámaras ──────────────────────────────────
import { fisica, paciente, cx, ucis } from '../config/dispositivos.js';
import { getPool }                    from '../db/conexion.js';
import { enviarAlerta }               from './telegramService.js';

// ── Estado en memoria ─────────────────────────────────────────────────────────
const estadosNVR    = {}; // { ip: { enCaida, numCaidas, fallosConsecutivos } }
const estadosCamara = {}; // { ip: { enCaida, nvrNombre, fallosConsecutivos } }

let ultimoEstado        = null;
const eventosPendientes = [];

// ── Inicializar estados ───────────────────────────────────────────────────────
export function inicializarEstados() {
  const todas = [...fisica, ...paciente, ...cx, ...ucis];
  todas.forEach(nvr => {
    estadosNVR[nvr.ip] = { enCaida: false, numCaidas: 0, fallosConsecutivos: 0 };
    nvr.camaras.forEach(cam => {
      estadosCamara[cam.ip] = { enCaida: false, nvrNombre: nvr.nombre, fallosConsecutivos: 0 };
    });
  });
}

// ── Sincronizar estados desde BD al arrancar ──────────────────────────────────
export async function sincronizarEstadosDesdeDB() {
  try {
    const [rows] = await getPool().query(`
      SELECT ip, tipo FROM eventos e1
      WHERE fecha = (SELECT MAX(fecha) FROM eventos e2 WHERE e2.ip = e1.ip)
    `);
    rows.forEach(row => {
      if (row.tipo === 'caida') {
        if (estadosNVR[row.ip])    estadosNVR[row.ip].enCaida    = true;
        if (estadosCamara[row.ip]) estadosCamara[row.ip].enCaida = true;
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
      const ctrl = new AbortController();
      const t    = setTimeout(() => ctrl.abort(), 4000);
      await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      return true;
    } catch { }
  }
  return false;
}

// ── Guardar evento en MySQL ───────────────────────────────────────────────────
async function guardarEvento(nombre, ip, tipo, tipoDispositivo, nvrNombre = null) {
  try {
    await getPool().execute(
      'INSERT INTO eventos (nombre, ip, tipo, tipo_dispositivo, nvr_nombre) VALUES (?, ?, ?, ?, ?)',
      [nombre, ip, tipo, tipoDispositivo, nvrNombre]
    );
  } catch (err) {
    console.error('Error al guardar evento:', err.message);
  }
}

// ── Chequeo completo ──────────────────────────────────────────────────────────
export async function chequearTodo() {
  const secciones = { fisica, paciente, cx, ucis };
  const resultado = {};

  await Promise.all(Object.entries(secciones).map(async ([key, lista]) => {
    resultado[key] = await Promise.all(lista.map(async nvr => {
      const activo = await verificarDispositivo(nvr.ip);
      const est    = estadosNVR[nvr.ip];

      // Acumular o resetear fallos consecutivos
      if (!activo) { est.fallosConsecutivos++; }
      else         { est.fallosConsecutivos = 0; }

      // Caída: solo al SEGUNDO fallo consecutivo (evita falsos positivos)
      if (est.fallosConsecutivos === 2 && !est.enCaida) {
        est.enCaida = true;
        est.numCaidas++;
        const fecha = new Date().toLocaleString('es-CO');
        await guardarEvento(nvr.nombre, nvr.ip, 'caida', 'nvr');
        await enviarAlerta(`NVR CAIDO\nNombre: ${nvr.nombre}\nIP: ${nvr.ip}\nFecha: ${fecha}`);
        eventosPendientes.push({ tipo: 'caida', tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip });
      }

      // Recuperación
      if (activo && est.enCaida) {
        est.enCaida = false;
        const fecha = new Date().toLocaleString('es-CO');
        await guardarEvento(nvr.nombre, nvr.ip, 'recuperacion', 'nvr');
        await enviarAlerta(`NVR RECUPERADO\nNombre: ${nvr.nombre}\nIP: ${nvr.ip}\nFecha: ${fecha}`);
        eventosPendientes.push({ tipo: 'recuperacion', tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip });
      }

      // Cámaras
      const camaras = await Promise.all(nvr.camaras.map(async cam => {
        const camActiva = await verificarDispositivo(cam.ip);
        if (!estadosCamara[cam.ip]) {
          estadosCamara[cam.ip] = { enCaida: false, nvrNombre: nvr.nombre, fallosConsecutivos: 0 };
        }
        const camEst = estadosCamara[cam.ip];

        if (!camActiva) { camEst.fallosConsecutivos++; }
        else            { camEst.fallosConsecutivos = 0; }

        if (camEst.fallosConsecutivos === 2 && !camEst.enCaida) {
          camEst.enCaida = true;
          const fecha = new Date().toLocaleString('es-CO');
          await guardarEvento(cam.nombre, cam.ip, 'caida', 'camara', nvr.nombre);
          await enviarAlerta(`CAMARA CAIDA\nNombre: ${cam.nombre}\nIP: ${cam.ip}\nNVR: ${nvr.nombre}\nFecha: ${fecha}`);
          eventosPendientes.push({ tipo: 'caida', tipoDispositivo: 'camara', nombre: cam.nombre, ip: cam.ip, nvrNombre: nvr.nombre });
        }

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

  ultimoEstado = resultado;
}

// ── Historial con filtros ─────────────────────────────────────────────────────
export async function obtenerHistorialFiltrado({ desde, hasta, ip, tipo, tipoDispositivo, hora, limite = 200 } = {}) {
  try {
    let query    = 'SELECT * FROM eventos WHERE 1=1';
    const params = [];

    // Filtro por rango de fechas (formato: "YYYY-MM-DD HH:MM:SS")
    if (desde) { query += ' AND fecha >= ?'; params.push(desde); }
    if (hasta) { query += ' AND fecha <= ?'; params.push(hasta); }

    // Filtro por IP o nombre
    if (ip) {
      query += ' AND (ip LIKE ? OR nombre LIKE ?)';
      params.push(`%${ip}%`, `%${ip}%`);
    }

    // Filtro por tipo de evento
    if (tipo) { query += ' AND tipo = ?'; params.push(tipo); }

    // Filtro por tipo de dispositivo
    if (tipoDispositivo) { query += ' AND tipo_dispositivo = ?'; params.push(tipoDispositivo); }

    // Filtro por hora del día (0-23) — muestra cualquier minuto de esa hora
    // Ej: hora=9 → muestra eventos de 09:00 a 09:59
    if (hora !== undefined && hora !== null && hora !== '') {
      query += ' AND HOUR(fecha) = ?';
      params.push(parseInt(hora));
    }

    query += ' ORDER BY fecha DESC LIMIT ?';
    params.push(limite);

    const [rows] = await getPool().query(query, params);
    return rows;
  } catch (err) {
    console.error('Error al obtener historial:', err.message);
    return [];
  }
}

// ── Getters para la API ───────────────────────────────────────────────────────
export function getUltimoEstado() { return ultimoEstado; }

export function consumirEventosPendientes() {
  const copia = [...eventosPendientes];
  eventosPendientes.length = 0;
  return copia;
}