// ── Servicio de monitoreo de NVRs y cámaras ──────────────────────────────────
import net from 'net';
import { fisica, paciente, cx, ucis } from '../config/dispositivos.js';
import { getPool }                    from '../db/conexion.js';
import { enviarAlerta, reintentarPendientes } from './telegramService.js';
import { getIO }                      from './socketService.js';
import { esHorarioLaboral }           from './horarioService.js';
import {
  MINUTOS_SOSTENIDO_NO_LABORAL,
  VENTANA_FLAPPING_MINUTOS,
  CAMBIOS_FLAPPING_UMBRAL,
  UMBRAL_CORDURA_PORCENTAJE
} from '../config/horarioLaboral.js';

// ── Estado en memoria ─────────────────────────────────────────────────────────
// enCaida               → si está caído ahora mismo
// numCaidas             → contador histórico de caídas (se muestra en la tarjeta)
// fallosConsecutivos    → chequeos seguidos con resultado "fallo" (2 o más → caída)
// exitosConsecutivos    → chequeos seguidos con resultado "éxito" (2 o más → recuperación)
// estadoVisual          → 'normal' | 'degradado' | 'caido' — lo que se pinta en la web
// cambiosEstado         → timestamps de los últimos cambios de enCaida (detecta flapping)
// inestable             → true si está parpadeando demasiado (se deja de notificar cada cambio)
// cayoDesde             → cuándo empezó la caída actual (para el aviso "sostenido" nocturno)
// fechaCaidaTexto       → fecha legible de esa misma caída (para el mensaje, aunque se avise después)
// avisoSostenidoEnviado → evita reenviar el mismo aviso de "caída sostenida" en cada chequeo
const estadosNVR    = {};
const estadosCamara = {};

let ultimoEstado        = null;
const eventosPendientes = [];

// Umbral para decidir si un mensaje de Telegram va uno por uno (detalle
// completo) o resumido en un solo mensaje (incidente masivo).
const UMBRAL_TELEGRAM_MASIVO = 10;

// Se compara contra el chequeo anterior para detectar la transición de
// "no laboral" a "laboral" y mandar el resumen de la noche en ese momento.
let eraLaboralAnterior = null;
let resumenNocturno    = crearResumenNocturnoVacio();

function crearResumenNocturnoVacio() {
  return { inestabilidades: 0, caidasSostenidas: [], recuperacionesSostenidas: [] };
}

// ── Crear el estado inicial de un dispositivo ─────────────────────────────────
function estadoInicial(extra = {}) {
  return {
    enCaida: false,
    numCaidas: 0,
    fallosConsecutivos: 0,
    exitosConsecutivos: 0,
    estadoVisual: 'normal',
    cambiosEstado: [],
    inestable: false,
    cayoDesde: null,
    fechaCaidaTexto: null,
    avisoSostenidoEnviado: false,
    ...extra
  };
}

// ── Inicializar estados ───────────────────────────────────────────────────────
export function inicializarEstados() {
  const todas = [...fisica, ...paciente, ...cx, ...ucis];
  todas.forEach(nvr => {
    estadosNVR[nvr.ip] = estadoInicial();
    nvr.camaras.forEach(cam => {
      estadosCamara[cam.ip] = estadoInicial({ nvrNombre: nvr.nombre });
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
        if (estadosNVR[row.ip])    { estadosNVR[row.ip].enCaida    = true; estadosNVR[row.ip].estadoVisual    = 'caido'; }
        if (estadosCamara[row.ip]) { estadosCamara[row.ip].enCaida = true; estadosCamara[row.ip].estadoVisual = 'caido'; }
      }
    });
  } catch (err) {
    console.error('Error al sincronizar estados:', err.message);
  }
}

// ── Verificar si un dispositivo responde por HTTP (un solo intento) ──────────
// Las 3 URLs se prueban EN PARALELO (Promise.any: basta que una responda),
// no una tras otra. Antes se probaban secuencialmente, lo que significaba que
// un dispositivo realmente caído podía tardar hasta 12 segundos en confirmarse
// (3 URLs x 4s de timeout cada una) — con esto, el peor caso baja a 4 segundos,
// y se mantienen abiertas muchas menos conexiones por más tiempo.
async function verificarDispositivo(ip) {
  const urls = [
    `http://${ip}/`,
    `http://${ip}/favicon.ico`,
    `http://${ip}/doc/page/login.asp`
  ];
  try {
    await Promise.any(urls.map(url => {
      const ctrl = new AbortController();
      const t    = setTimeout(() => ctrl.abort(), 4000);
      return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
    }));
    return true;
  } catch {
    return false; // Promise.any solo lanza si TODAS las URLs fallaron
  }
}

// ── Verificar con 3 intentos, para medir % de éxito real ──────────────────────
// En vez de confiar en un solo intento (que puede fallar por un parpadeo de
// red de un instante), se hacen 3 intentos en paralelo y se cuentan cuántos
// respondieron. Esto permite distinguir un dispositivo sano (3/3), uno
// degradado (2/3 — responde, pero con problemas) de uno realmente caído
// (0 o 1 de 3).
async function verificarConPorcentaje(ip) {
  const intentos = await Promise.all([
    verificarDispositivo(ip),
    verificarDispositivo(ip),
    verificarDispositivo(ip)
  ]);
  const exitos = intentos.filter(Boolean).length;
  return exitos;
}

// ── Capa 2: confirmar que el SERVICIO DE VIDEO responde, no solo la red ──────
// El chequeo de arriba (HTTP a la interfaz web) puede decir "vivo" aunque el
// video esté colgado — la interfaz web y el servicio de video son procesos
// distintos dentro del mismo equipo, y uno puede caerse sin el otro.
//
// Este chequeo abre una conexión TCP directa a los puertos reales de video:
// 554 (RTSP, estándar en cualquier cámara/NVR IP sin importar la marca),
// 8000 (gestión Hikvision) y 37777 (gestión Dahua). No hace falta saber la
// marca de cada equipo — se prueban los tres en paralelo y basta con que
// uno responda.
//
// Se ejecuta UNA sola vez por dispositivo por ciclo (no 3 veces, como el
// chequeo HTTP): es una capa de confirmación, no de medición de porcentaje,
// y así se evita triplicar la cantidad de conexiones de red abiertas por
// ciclo — justo el tipo de saturación que ya causó problemas antes.
const PUERTOS_VIDEO = [554, 8000, 37777];

function verificarPuertoTCP(ip, puerto, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let resuelto = false;

    const finalizar = (fn, valor) => {
      if (resuelto) return;
      resuelto = true;
      socket.destroy();
      fn(valor);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finalizar(resolve, true));
    socket.once('timeout', () => finalizar(reject, new Error('timeout')));
    socket.once('error',   () => finalizar(reject, new Error('error')));

    socket.connect(puerto, ip);
  });
}

async function verificarServicioVideo(ip) {
  try {
    await Promise.any(PUERTOS_VIDEO.map(puerto => verificarPuertoTCP(ip, puerto)));
    return true;
  } catch {
    return false; // Promise.any solo lanza si LOS TRES puertos fallaron
  }
}

// ── Ejecutar tareas con un límite de concurrencia ─────────────────────────────
// CRÍTICO para evitar saturar la red del propio equipo de monitoreo: sin este
// límite, con 1000+ dispositivos x 3 intentos, se podían llegar a abrir miles
// de conexiones de red AL MISMO TIEMPO — suficiente para saturar cualquier
// red normal y generar lecturas falsas por congestión propia, no por fallas
// reales de los NVRs/cámaras. Con este límite, nunca hay más de
// LIMITE_CONCURRENCIA dispositivos siendo chequeados a la vez, sin importar
// cuántos dispositivos existan en total.
const LIMITE_CONCURRENCIA = 40;

async function conLimiteConcurrencia(items, limite, fn) {
  const resultados = new Array(items.length);
  let indice = 0;

  async function trabajador() {
    while (indice < items.length) {
      const i = indice++;
      resultados[i] = await fn(items[i], i);
    }
  }

  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, trabajador);
  await Promise.all(trabajadores);
  return resultados;
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

// ── Registrar un cambio de estado (caída o recuperación) para detectar flapping ─
// Guarda el momento del cambio y descarta los más viejos que la ventana. Si la
// cantidad de cambios recientes supera el umbral, el dispositivo se marca
// "inestable" (deja de notificarse cada parpadeo por Telegram, ver más abajo).
function registrarCambioEstado(estado) {
  const ahora  = Date.now();
  const limite = ahora - VENTANA_FLAPPING_MINUTOS * 60 * 1000;

  estado.cambiosEstado.push(ahora);
  estado.cambiosEstado = estado.cambiosEstado.filter(t => t > limite);

  const eraInestable = estado.inestable;
  estado.inestable    = estado.cambiosEstado.length >= CAMBIOS_FLAPPING_UMBRAL;

  return {
    volviendoseInestable: !eraInestable && estado.inestable,
    estabilizandose:       eraInestable && !estado.inestable
  };
}

// ── Procesar el resultado de un chequeo contra el estado guardado ────────────
// Aplica las reglas de: 2 fallos seguidos → caída, 2 éxitos seguidos →
// recuperación (simétrico), calcula el estado visual de 3 niveles, y detecta
// cambios de flapping. Devuelve qué pasó, para que el llamador decida cómo
// notificarlo (o si hay que notificarlo).
function procesarChequeo(estado, exitos) {
  const esFallo     = exitos <= 1; // 0 o 1 de 3 intentos exitosos → cuenta como fallo real
  const esDegradado = exitos === 2; // 2 de 3 → responde, pero con problemas

  if (esFallo) { estado.fallosConsecutivos++; estado.exitosConsecutivos = 0; }
  else         { estado.exitosConsecutivos++; estado.fallosConsecutivos = 0; }

  let huboCaida = false, huboRecuperacion = false, fueEscaladaLaCaida = false;
  let cambioFlapping = { volviendoseInestable: false, estabilizandose: false };

  if (estado.fallosConsecutivos === 2 && !estado.enCaida) {
    estado.enCaida               = true;
    estado.cayoDesde              = Date.now();
    estado.fechaCaidaTexto        = new Date().toLocaleString('es-CO');
    estado.avisoSostenidoEnviado = false;
    huboCaida       = true;
    cambioFlapping  = registrarCambioEstado(estado);

  } else if (estado.exitosConsecutivos === 2 && estado.enCaida) {
    fueEscaladaLaCaida = estado.avisoSostenidoEnviado;
    estado.enCaida               = false;
    estado.cayoDesde              = null;
    estado.avisoSostenidoEnviado = false;
    huboRecuperacion = true;
    cambioFlapping   = registrarCambioEstado(estado);
  }

  estado.estadoVisual = estado.enCaida ? 'caido' : (esDegradado ? 'degradado' : 'normal');

  return { huboCaida, huboRecuperacion, fueEscaladaLaCaida, ...cambioFlapping };
}

// Evita que dos chequeos corran al mismo tiempo. Si uno se demora más de lo
// normal (ej: por congestión de red), el siguiente NO se apila encima —
// simplemente se salta ese ciclo y espera al próximo. Esto es justo lo que
// evita que el sistema se vuelva más y más inconsistente con el tiempo.
let chequeoEnCurso = false;

// ── Chequeo completo ──────────────────────────────────────────────────────────
export async function chequearTodo() {
  if (chequeoEnCurso) {
    console.log('Chequeo anterior todavía en curso — se salta este ciclo para no solaparlos.');
    return;
  }
  chequeoEnCurso = true;

  try {
    await reintentarPendientes(); // Primero, reintentar lo que quedó pendiente de Telegram

    const secciones    = { fisica, paciente, cx, ucis };
    const laboralAhora = esHorarioLaboral();

    // ── FASE 1: recolectar los resultados crudos de TODOS los dispositivos ───
    // Se arma una lista plana de "tareas" (cada NVR y cada cámara, sin
    // importar su zona) y se procesan con un límite de concurrencia — así,
    // sin importar si hay 40 o 4000 dispositivos, nunca se abren más de
    // LIMITE_CONCURRENCIA conexiones de red a la vez.
    const tareas = [];
    for (const [key, lista] of Object.entries(secciones)) {
      for (const nvr of lista) {
        tareas.push({ tipo: 'nvr', key, nvr });
        for (const cam of nvr.camaras) {
          tareas.push({ tipo: 'camara', key, nvr, cam });
        }
      }
    }

    const resultadosCrudos = await conLimiteConcurrencia(tareas, LIMITE_CONCURRENCIA, async tarea => {
      const ip         = tarea.tipo === 'nvr' ? tarea.nvr.ip : tarea.cam.ip;
      const exitosHTTP = await verificarConPorcentaje(ip);

      // Capa 2: si la red ya respondió, confirmar que el servicio de video
      // también. Si la red ya estaba completamente caída (exitosHTTP === 0),
      // no tiene caso gastar otra conexión — ya se sabe que está caído.
      if (exitosHTTP === 0) {
        return { ...tarea, exitos: 0 };
      }
      const videoActivo = await verificarServicioVideo(ip);
      // Red viva pero video colgado: se trata como caída real, no como
      // "normal" ni "degradado" — el propósito del sistema es la cobertura
      // de video, no que responda una página web.
      return { ...tarea, exitos: videoActivo ? exitosHTTP : 0 };
    });

    // Reagrupar en la misma estructura por zona → NVR → cámaras, para procesar
    // el estado exactamente igual que antes.
    const crudos = {};
    for (const key of Object.keys(secciones)) crudos[key] = [];
    const indicePorNVR = new Map(); // ip del NVR → índice en crudos[key]

    for (const r of resultadosCrudos) {
      if (r.tipo === 'nvr') {
        crudos[r.key].push({ nvr: r.nvr, exitosNVR: r.exitos, camaras: [] });
        indicePorNVR.set(r.nvr.ip, crudos[r.key].length - 1);
      }
    }
    for (const r of resultadosCrudos) {
      if (r.tipo === 'camara') {
        const idx = indicePorNVR.get(r.nvr.ip);
        crudos[r.key][idx].camaras.push({ cam: r.cam, exitos: r.exitos });
      }
    }

    let totalDispositivos = 0, totalFallidos = 0;
    for (const key in crudos) {
    for (const item of crudos[key]) {
      totalDispositivos++;
      if (item.exitosNVR <= 1) totalFallidos++;
      for (const c of item.camaras) {
        totalDispositivos++;
        if (c.exitos <= 1) totalFallidos++;
      }
    }
  }
  const porcentajeFallo = totalDispositivos > 0 ? (totalFallidos / totalDispositivos) * 100 : 0;

  if (porcentajeFallo > UMBRAL_CORDURA_PORCENTAJE) {
    console.log(
      `Chequeo omitido: ${porcentajeFallo.toFixed(0)}% de los dispositivos fallaron a la vez. ` +
      `Es más probable que sea el equipo de monitoreo el que perdió conectividad, no la red del ` +
      `hospital — no se actualiza ningún estado ni se envía ninguna alerta este ciclo.`
    );
    return;
  }

  // ── FASE 2: procesar cada dispositivo contra su estado guardado ───────────
  const resultado = {};
  const telegramCaidas        = [];
  const telegramRecuperados   = [];
  const telegramInestables    = [];
  const telegramEstabilizados = [];

  for (const [key, lista] of Object.entries(crudos)) {
    resultado[key] = await Promise.all(lista.map(async ({ nvr, exitosNVR, camaras }) => {
      const est = estadosNVR[nvr.ip];
      const r   = procesarChequeo(est, exitosNVR);

      if (r.huboCaida) {
        est.numCaidas++;
        await guardarEvento(nvr.nombre, nvr.ip, 'caida', 'nvr');
        const evento = { tipo: 'caida', tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip };
        eventosPendientes.push(evento);
        getIO()?.emit('evento', evento);
        enrutarTelegramCaida(est, { tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip, fecha: est.fechaCaidaTexto }, laboralAhora, telegramCaidas);
      }

      if (r.huboRecuperacion) {
        await guardarEvento(nvr.nombre, nvr.ip, 'recuperacion', 'nvr');
        const evento = { tipo: 'recuperacion', tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip };
        eventosPendientes.push(evento);
        getIO()?.emit('evento', evento);
        enrutarTelegramRecuperacion(est, { tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip, fecha: new Date().toLocaleString('es-CO') }, laboralAhora, r.fueEscaladaLaCaida, telegramRecuperados, resumenNocturno);
      }

      procesarFlappingYSostenido(est, r, { tipoDispositivo: 'nvr', nombre: nvr.nombre, ip: nvr.ip }, laboralAhora, telegramInestables, telegramEstabilizados, telegramCaidas, resumenNocturno);

      const camarasProcesadas = await Promise.all(camaras.map(async ({ cam, exitos }) => {
        if (!estadosCamara[cam.ip]) estadosCamara[cam.ip] = estadoInicial({ nvrNombre: nvr.nombre });
        const camEst = estadosCamara[cam.ip];
        const rc = procesarChequeo(camEst, exitos);

        if (rc.huboCaida) {
          await guardarEvento(cam.nombre, cam.ip, 'caida', 'camara', nvr.nombre);
          const evento = { tipo: 'caida', tipoDispositivo: 'camara', nombre: cam.nombre, ip: cam.ip, nvrNombre: nvr.nombre };
          eventosPendientes.push(evento);
          getIO()?.emit('evento', evento);
          enrutarTelegramCaida(camEst, { tipoDispositivo: 'camara', nombre: cam.nombre, ip: cam.ip, nvrNombre: nvr.nombre, fecha: camEst.fechaCaidaTexto }, laboralAhora, telegramCaidas);
        }

        if (rc.huboRecuperacion) {
          await guardarEvento(cam.nombre, cam.ip, 'recuperacion', 'camara', nvr.nombre);
          const evento = { tipo: 'recuperacion', tipoDispositivo: 'camara', nombre: cam.nombre, ip: cam.ip, nvrNombre: nvr.nombre };
          eventosPendientes.push(evento);
          getIO()?.emit('evento', evento);
          enrutarTelegramRecuperacion(camEst, { tipoDispositivo: 'camara', nombre: cam.nombre, ip: cam.ip, nvrNombre: nvr.nombre, fecha: new Date().toLocaleString('es-CO') }, laboralAhora, rc.fueEscaladaLaCaida, telegramRecuperados, resumenNocturno);
        }

        procesarFlappingYSostenido(camEst, rc, { tipoDispositivo: 'camara', nombre: cam.nombre, ip: cam.ip, nvrNombre: nvr.nombre }, laboralAhora, telegramInestables, telegramEstabilizados, telegramCaidas, resumenNocturno);

        return {
          nombre: cam.nombre, ip: cam.ip,
          activo: exitos >= 2, enCaida: camEst.enCaida,
          estadoVisual: camEst.estadoVisual, inestable: camEst.inestable
        };
      }));

      return {
        nombre: nvr.nombre, ip: nvr.ip,
        activo: exitosNVR >= 2, enCaida: est.enCaida, numCaidas: est.numCaidas,
        estadoVisual: est.estadoVisual, inestable: est.inestable,
        camaras: camarasProcesadas
      };
    }));
  }

  ultimoEstado = resultado;
  getIO()?.emit('estado', resultado); // Empuja el estado a todos los navegadores conectados, al instante

  // Al pasar de horario no laboral a laboral, mandar el resumen de la noche
  if (eraLaboralAnterior === false && laboralAhora === true) {
    await enviarResumenNocturno();
  }
  eraLaboralAnterior = laboralAhora;

  // Avisar por Telegram: individual si son pocos, resumido si es un incidente masivo
  await enviarGrupoTelegram(telegramCaidas,      'caida');
  await enviarGrupoTelegram(telegramRecuperados, 'recuperacion');
  await enviarAvisosInestabilidad(telegramInestables, telegramEstabilizados);

  } catch (err) {
    console.error('Error inesperado durante el chequeo:', err.message);
  } finally {
    chequeoEnCurso = false; // SIEMPRE se libera el candado, incluso si algo falló
  }
}

// ── Decidir si una caída se notifica ahora, se guarda para "sostenido", o se suprime ──
function enrutarTelegramCaida(estado, datos, laboralAhora, telegramCaidas) {
  if (estado.inestable) return; // Parpadeando: ya se avisó "está inestable", no se repite cada vez
  if (laboralAhora) telegramCaidas.push(datos);
  // Si NO es laboral: no se notifica de inmediato. Se espera a confirmarla
  // como "sostenida" en procesarFlappingYSostenido, en un chequeo posterior.
}

// ── Decidir si una recuperación se notifica ──────────────────────────────────
function enrutarTelegramRecuperacion(estado, datos, laboralAhora, fueEscaladaLaCaida, telegramRecuperados, resumenNocturno) {
  if (estado.inestable) return; // Parpadeando: se espera al aviso de "se estabilizó"

  if (laboralAhora) {
    telegramRecuperados.push(datos);
  } else if (fueEscaladaLaCaida) {
    // Solo se notifica la recuperación nocturna si la caída sí se había
    // escalado antes (fue sostenida) — si nunca se avisó la caída, avisar
    // la recuperación sería un mensaje huérfano y confuso.
    telegramRecuperados.push(datos);
    resumenNocturno.recuperacionesSostenidas.push(`${datos.nombre} (${datos.ip})`);
  }
}

// ── Avisos de flapping (inestable / se estabilizó) y de caída sostenida nocturna ──
function procesarFlappingYSostenido(estado, resultadoProceso, datos, laboralAhora, telegramInestables, telegramEstabilizados, telegramCaidas, resumenNocturno) {
  if (resultadoProceso.volviendoseInestable) {
    telegramInestables.push(datos);
    if (!laboralAhora) resumenNocturno.inestabilidades++;
  }
  if (resultadoProceso.estabilizandose) {
    telegramEstabilizados.push(datos);
  }

  // Caída sostenida en horario no laboral: revisar en CADA chequeo (no solo
  // el que la detectó) si ya lleva el tiempo mínimo para escalarla.
  if (!laboralAhora && estado.enCaida && !estado.avisoSostenidoEnviado && !estado.inestable) {
    const minutosCaido = (Date.now() - estado.cayoDesde) / 60000;
    if (minutosCaido >= MINUTOS_SOSTENIDO_NO_LABORAL) {
      estado.avisoSostenidoEnviado = true;
      telegramCaidas.push({ ...datos, fecha: estado.fechaCaidaTexto });
      resumenNocturno.caidasSostenidas.push(`${datos.nombre} (${datos.ip})`);
    }
  }
}

// ── Mensaje del resumen matutino ──────────────────────────────────────────────
async function enviarResumenNocturno() {
  const { inestabilidades, caidasSostenidas, recuperacionesSostenidas } = resumenNocturno;

  if (inestabilidades === 0 && caidasSostenidas.length === 0) {
    resumenNocturno = crearResumenNocturnoVacio();
    return; // Noche tranquila: ni vale la pena mandar un resumen vacío
  }

  const lineas = ['RESUMEN DE LA NOCHE'];
  if (caidasSostenidas.length > 0) {
    lineas.push(`Caídas reales sostenidas (${caidasSostenidas.length}):`);
    lineas.push(...caidasSostenidas);
    lineas.push(`De esas, ya recuperadas: ${recuperacionesSostenidas.length}`);
  }
  if (inestabilidades > 0) {
    lineas.push(`Dispositivos con inestabilidad breve (parpadeo): ${inestabilidades}`);
  }
  lineas.push('Revisa el historial para el detalle completo.');

  await enviarAlerta(lineas.join('\n'));
  resumenNocturno = crearResumenNocturnoVacio();
}

// ── Avisos individuales de "está inestable" / "se estabilizó" ────────────────
async function enviarAvisosInestabilidad(inestables, estabilizados) {
  for (const d of inestables) {
    const tipo = d.tipoDispositivo === 'nvr' ? 'NVR' : 'CAMARA';
    await enviarAlerta(`${tipo} INESTABLE\nNombre: ${d.nombre}\nIP: ${d.ip}${d.nvrNombre ? `\nNVR: ${d.nvrNombre}` : ''}\nSe detectaron varios cambios de estado seguidos — se dejan de notificar sus cambios individuales hasta que se estabilice.`);
  }
  for (const d of estabilizados) {
    const tipo = d.tipoDispositivo === 'nvr' ? 'NVR' : 'CAMARA';
    await enviarAlerta(`${tipo} ESTABILIZADO\nNombre: ${d.nombre}\nIP: ${d.ip}${d.nvrNombre ? `\nNVR: ${d.nvrNombre}` : ''}\nVuelve a notificar sus cambios de estado normalmente.`);
  }
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

    if (desde) { query += ' AND fecha >= ?'; params.push(desde); }
    if (hasta) { query += ' AND fecha <= ?'; params.push(hasta); }

    if (ip) {
      query += ' AND (ip LIKE ? OR nombre LIKE ?)';
      params.push(`%${ip}%`, `%${ip}%`);
    }

    if (tipo) { query += ' AND tipo = ?'; params.push(tipo); }
    if (tipoDispositivo) { query += ' AND tipo_dispositivo = ?'; params.push(tipoDispositivo); }

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