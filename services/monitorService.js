// ── Servicio de monitoreo de NVRs y cámaras ──────────────────────────────────
import { fisica, paciente, cx, ucis } from '../config/dispositivos.js';
import { getPool }                    from '../db/conexion.js';
import { enviarAlerta, reintentarPendientes } from './telegramService.js';
import { getIO }                      from './socketService.js';

// ── Estado en memoria ─────────────────────────────────────────────────────────
const estadosNVR    = {}; // { ip: { enCaida, numCaidas, fallosConsecutivos } }
const estadosCamara = {}; // { ip: { enCaida, nvrNombre, fallosConsecutivos } }

let ultimoEstado        = null;
const eventosPendientes = [];

// Umbral para decidir si un mensaje de Telegram va uno por uno (detalle
// completo) o resumido en un solo mensaje (incidente masivo). Se evalúa por
// separado para caídas y para recuperaciones, y por separado para NVRs y
// cámaras: si CUALQUIERA de los dos (NVRs caídos o cámaras caídas) supera
// este número en el mismo chequeo, se resume todo en un solo mensaje.
const UMBRAL_TELEGRAM_MASIVO = 10;

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
  await reintentarPendientes(); // Primero, reintentar lo que quedó pendiente de Telegram

  const secciones = { fisica, paciente, cx, ucis };
  const resultado = {};

  // Eventos detectados en ESTA vuelta de chequeo, agrupados para decidir cómo
  // avisarlos por Telegram al final (uno por uno vs. resumen masivo).
  const telegramCaidas       = [];
  const telegramRecuperados  = [];

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
        telegramCaidas.push({ tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip, fecha });
        const evento = { tipo: 'caida', tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip };
        eventosPendientes.push(evento);
        getIO()?.emit('evento', evento);
      }

      // Recuperación
      if (activo && est.enCaida) {
        est.enCaida = false;
        const fecha = new Date().toLocaleString('es-CO');
        await guardarEvento(nvr.nombre, nvr.ip, 'recuperacion', 'nvr');
        telegramRecuperados.push({ tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip, fecha });
        const evento = { tipo: 'recuperacion', tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip };
        eventosPendientes.push(evento);
        getIO()?.emit('evento', evento);
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
          telegramCaidas.push({ tipoDispositivo: 'camara', nombre: cam.nombre, ip: cam.ip, nvrNombre: nvr.nombre, fecha });
          const evento = { tipo: 'caida', tipoDispositivo: 'camara', nombre: cam.nombre, ip: cam.ip, nvrNombre: nvr.nombre };
          eventosPendientes.push(evento);
          getIO()?.emit('evento', evento);
        }

        if (camActiva && camEst.enCaida) {
          camEst.enCaida = false;
          const fecha = new Date().toLocaleString('es-CO');
          await guardarEvento(cam.nombre, cam.ip, 'recuperacion', 'camara', nvr.nombre);
          telegramRecuperados.push({ tipoDispositivo: 'camara', nombre: cam.nombre, ip: cam.ip, nvrNombre: nvr.nombre, fecha });
          const evento = { tipo: 'recuperacion', tipoDispositivo: 'camara', nombre: cam.nombre, ip: cam.ip, nvrNombre: nvr.nombre };
          eventosPendientes.push(evento);
          getIO()?.emit('evento', evento);
        }

        return { nombre: cam.nombre, ip: cam.ip, activo: camActiva, enCaida: camEst.enCaida };
      }));

      return { nombre: nvr.nombre, ip: nvr.ip, activo, enCaida: est.enCaida, numCaidas: est.numCaidas, camaras };
    }));
  }));

  ultimoEstado = resultado;
  getIO()?.emit('estado', resultado); // Empuja el estado a todos los navegadores conectados, al instante

  // Avisar por Telegram: individual si son pocos, resumido si es un incidente masivo
  await enviarGrupoTelegram(telegramCaidas,      'caida');
  await enviarGrupoTelegram(telegramRecuperados, 'recuperacion');
}

// ── Decidir y enviar los avisos de Telegram de un grupo de eventos ───────────
async function enviarGrupoTelegram(eventos, tipo) {
  if (eventos.length === 0) return;

  const nvrs    = eventos.filter(e => e.tipoDispositivo === 'nvr');
  const camaras = eventos.filter(e => e.tipoDispositivo === 'camara');
  const esMasivo = nvrs.length > UMBRAL_TELEGRAM_MASIVO || camaras.length > UMBRAL_TELEGRAM_MASIVO;

  if (esMasivo) {
    await enviarAlerta(formatearResumenMasivo(tipo, nvrs.length, camaras.length));
    return;
  }

  // Pocos casos (o combinaciones chicas, ej: 1 NVR + 1 cámara): uno por uno,
  // con el detalle completo, igual que antes.
  for (const ev of eventos) {
    await enviarAlerta(formatearEventoIndividual(ev, tipo));
  }
}

// ── Mensaje resumido para incidentes masivos ─────────────────────────────────
function formatearResumenMasivo(tipo, cantidadNVR, cantidadCamaras) {
  const fecha      = new Date().toLocaleString('es-CO');
  const esCaida    = tipo === 'caida';
  const encabezado = esCaida ? 'INCIDENTE MASIVO DETECTADO' : 'RECUPERACION MASIVA';

  const lineas = [];
  if (cantidadNVR > 0) {
    lineas.push(`${cantidadNVR} NVR(s) ${esCaida ? 'caído(s)' : 'recuperado(s)'}`);
  }
  if (cantidadCamaras > 0) {
    lineas.push(`${cantidadCamaras} cámara(s) ${esCaida ? 'caída(s)' : 'recuperada(s)'}`);
  }

  let mensaje = `${encabezado}\n${lineas.join('\n')}\nFecha: ${fecha}`;
  if (esCaida) mensaje += '\nRevisa el dashboard para el detalle completo.';
  return mensaje;
}

// ── Mensaje individual, con el mismo formato de siempre ───────────────────────
function formatearEventoIndividual(ev, tipo) {
  const esNVR   = ev.tipoDispositivo === 'nvr';
  const esCaida = tipo === 'caida';
  const titulo  = esNVR
    ? (esCaida ? 'NVR CAIDO'     : 'NVR RECUPERADO')
    : (esCaida ? 'CAMARA CAIDA'  : 'CAMARA RECUPERADA');

  let mensaje = `${titulo}\nNombre: ${ev.nombre}\nIP: ${ev.ip}`;
  if (!esNVR) mensaje += `\nNVR: ${ev.nvrNombre}`;
  mensaje += `\nFecha: ${ev.fecha}`;
  return mensaje;
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