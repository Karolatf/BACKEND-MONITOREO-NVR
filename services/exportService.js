// ── Servicio de exportación del historial (Excel y PDF) ───────────────────────
// Genera reportes con formato profesional e institucional (FCV/HIC), listos
// para imprimir. Optimizado con diseño editorial (grids y áreas de impresión).
import ExcelJS       from 'exceljs';
import PDFDocument   from 'pdfkit';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath }            from 'url';
import { dirname, join }            from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const RUTA_LOGO  = join(__dirname, '..', 'assets', 'logo-hic.png');

// ── Paleta Institucional FCV / HIC (Estricta) ───────────────────────────────
const COLOR = {
  vino:       '#98183a', 
  grisOscuro: '#2b2b2b', 
  grisTexto:  '#595959', 
  grisClaro:  '#8c8c8c', 
  grisBorde:  '#e5e5e5', 
  grisFondo:  '#f8f9fa', 
  blanco:     '#ffffff',
  rojo:       '#d32f2f', 
  verde:      '#2e7d32', 
};

const ARGB = {
  vino:       'FF98183A',
  grisOscuro: 'FF2B2B2B',
  grisTexto:  'FF595959',
  grisClaro:  'FF8C8C8C',
  grisBorde:  'FFE5E5E5',
  grisFondo:  'FFF8F9FA',
  blanco:     'FFFFFFFF',
  rojo:       'FFD32F2F',
  verde:      'FF2E7D32',
};

// ── Validación manual del PNG ─────────────────────────────────────────────────
function validarPNG(buffer) {
  const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer || buffer.length < 33) return null;
  if (!buffer.subarray(0, 8).equals(FIRMA_PNG)) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;

  const ancho = buffer.readUInt32BE(16);
  const alto  = buffer.readUInt32BE(20);
  if (ancho <= 0 || alto <= 0 || ancho > 10000 || alto > 10000) return null;

  let pos = 8;
  while (pos + 8 <= buffer.length) {
    const longitudChunk = buffer.readUInt32BE(pos);
    const tipoChunk     = buffer.toString('ascii', pos + 4, pos + 8);
    const finChunk      = pos + 8 + longitudChunk + 4; 
    if (finChunk > buffer.length) return null;
    if (tipoChunk === 'IEND') {
      return finChunk === buffer.length ? { ancho, alto } : null;
    }
    pos = finChunk;
  }
  return null;
}

let bufferLogo = null;
let logoRatio  = 1;

if (!existsSync(RUTA_LOGO)) {
  console.error(`⚠ No se encontró el logo en ${RUTA_LOGO}. Generando sin logo.`);
} else {
  try {
    const candidato   = readFileSync(RUTA_LOGO);
    const dimensiones = validarPNG(candidato);
    if (dimensiones) {
      bufferLogo = candidato;
      logoRatio  = dimensiones.ancho / dimensiones.alto;
    }
  } catch (err) {
    console.error('No se pudo leer el logo:', err.message);
  }
}

const NOMBRE_HOSPITAL = 'Fundación Cardiovascular de Colombia — Hospital Internacional de Colombia';
const TEXTO_TIPO = { caida: 'Caída', recuperacion: 'Recuperación' };
const TEXTO_DISPOSITIVO = { nvr: 'NVR', camara: 'Cámara' };

// ═══════════════════════════════════════════════════════════════════════════
// EXCEL: MAQUETACIÓN PROFESIONAL Y CONFIGURACIÓN DE IMPRESIÓN
// ═══════════════════════════════════════════════════════════════════════════
export async function generarExcelHistorial(eventos, descripcionFiltros = 'Sin filtros aplicados') {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Fundación Cardiovascular de Colombia';
  libro.created = new Date();

  // 1. Hoja de Resumen (Composición en A4 Vertical, 6 columnas)
  agregarHojaResumen(libro, eventos, descripcionFiltros);
  // 2. Hoja de Historial (Composición en A4 Horizontal, 6 columnas adaptadas)
  agregarHojaHistorial(libro, eventos, descripcionFiltros);

  return libro.xlsx.writeBuffer();
}

function configurarImpresion(hoja, orientacion, filaFinEncabezado) {
  hoja.pageSetup = {
    orientation: orientacion,
    paperSize: 9,             // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    horizontalCentered: true,
  };
  hoja.pageSetup.printTitlesRow = `1:${filaFinEncabezado}`;
  hoja.headerFooter.oddFooter = `&8&L${NOMBRE_HOSPITAL}&R&8Página &P de &N`;
}

// ── Hoja 1: Resumen Ejecutivo (A4 Vertical - Diseño Editorial Equilibrado) ──
function agregarHojaResumen(libro, eventos, descripcionFiltros) {
  const hoja = libro.addWorksheet('Resumen de Informe');
  hoja.views = [{ showGridLines: false }];

  // Grilla de 6 columnas simétricas y balanceadas
  hoja.columns = [
    { width: 14 }, { width: 16 }, // Bloque Izquierdo (Origen)
    { width: 10 },               // Columna separadora / central
    { width: 22 }, { width: 14 }, // Bloque Derecho (Dispositivos / IP)
    { width: 6 },                // Margen derecho de equilibrio
  ];

  // 1. ENCABEZADO INSTITUCIONAL
  hoja.getRow(1).height = 8;
  hoja.getRow(2).height = 22; // Título principal
  hoja.getRow(3).height = 18; // Hospital
  hoja.getRow(4).height = 16; // Metadatos
  hoja.getRow(5).height = 10; // Espaciador

  hoja.mergeCells('B2:F2');
  const celdaTitulo = hoja.getCell('B2');
  celdaTitulo.value = 'INFORME DE EVENTOS DE SEGURIDAD';
  celdaTitulo.font  = { bold: true, size: 15, color: { argb: ARGB.vino } };
  celdaTitulo.alignment = { vertical: 'middle', horizontal: 'left' };

  hoja.mergeCells('B3:F3');
  const celdaSub = hoja.getCell('B3');
  celdaSub.value = NOMBRE_HOSPITAL;
  celdaSub.font  = { bold: true, size: 10, color: { argb: ARGB.grisOscuro } };
  celdaSub.alignment = { vertical: 'middle', horizontal: 'left' };

  hoja.mergeCells('B4:F4');
  const celdaMeta = hoja.getCell('B4');
  celdaMeta.value = `Emisión: ${new Date().toLocaleString('es-CO')}   |   Filtros: ${descripcionFiltros}`;
  celdaMeta.font  = { size: 9, color: { argb: ARGB.grisTexto } };
  celdaMeta.alignment = { vertical: 'middle', horizontal: 'left' };

  // Línea divisoria institucional
  for (let i = 1; i <= 6; i++) {
    hoja.getCell(`${String.fromCharCode(64 + i)}5`).border = { bottom: { style: 'medium', color: { argb: ARGB.vino } } };
  }

  // Logo HIC perfectamente proporcionado y alineado con el encabezado (A1:A4)
  if (bufferLogo) {
    const idImagen = libro.addImage({ buffer: bufferLogo, extension: 'png' });
    hoja.addImage(idImagen, {
      tl: { col: 0.15, row: 1.1 },
      ext: { width: 54 * logoRatio, height: 54 } 
    });
  }

  // 2. TARJETAS DE ESTADÍSTICAS (KPIs simétricos y centrados)
  const totalCaidas      = eventos.filter(e => e.tipo === 'caida').length;
  const totalRecuperados = eventos.filter(e => e.tipo === 'recuperacion').length;
  
  const filaTarjetas = 7;
  hoja.getRow(filaTarjetas).height = 36;     
  hoja.getRow(filaTarjetas + 1).height = 20; 

  const dibujarKPI = (colInicio, colFin, valor, etiqueta, colorTexto, colorBorde) => {
    const l1 = String.fromCharCode(64 + colInicio);
    const l2 = String.fromCharCode(64 + colFin);
    
    hoja.mergeCells(`${l1}${filaTarjetas}:${l2}${filaTarjetas}`);
    const cv = hoja.getCell(`${l1}${filaTarjetas}`);
    cv.value = valor;
    cv.font  = { bold: true, size: 22, color: { argb: colorTexto } };
    cv.alignment = { vertical: 'middle', horizontal: 'center' };
    cv.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.grisFondo } };
    cv.border = { left: { style: 'medium', color: { argb: colorBorde } }, top: { style: 'thin', color: { argb: ARGB.grisBorde } }, right: { style: 'thin', color: { argb: ARGB.grisBorde } } };

    hoja.mergeCells(`${l1}${filaTarjetas + 1}:${l2}${filaTarjetas + 1}`);
    const ce = hoja.getCell(`${l1}${filaTarjetas + 1}`);
    ce.value = etiqueta;
    ce.font  = { size: 9, bold: true, color: { argb: ARGB.grisTexto } };
    ce.alignment = { vertical: 'top', horizontal: 'center' };
    ce.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.grisFondo } };
    ce.border = { left: { style: 'medium', color: { argb: colorBorde } }, bottom: { style: 'thin', color: { argb: ARGB.grisBorde } }, right: { style: 'thin', color: { argb: ARGB.grisBorde } } };
  };

  dibujarKPI(1, 2, eventos.length,   'TOTAL EVENTOS',  ARGB.vino,  ARGB.vino);
  dibujarKPI(3, 4, totalCaidas,      'CAÍDAS',         ARGB.rojo,  ARGB.rojo);
  dibujarKPI(5, 6, totalRecuperados, 'RECUPERACIONES', ARGB.verde, ARGB.verde);

  // 3. TABLAS LADO A LADO (Bloques equilibrados idénticos a Referencia 3)
  const filaTablas = 11;
  hoja.getRow(filaTablas).height = 22;

  // Títulos de sección perfectamente centrados sobre sus bloques correspondientes
  hoja.mergeCells(`A${filaTablas}:B${filaTablas}`);
  const t1 = hoja.getCell(`A${filaTablas}`);
  t1.value = 'DISTRIBUCIÓN POR ORIGEN';
  t1.font = { bold: true, size: 10.5, color: { argb: ARGB.vino } };
  t1.alignment = { vertical: 'middle', horizontal: 'left' };
  t1.border = { bottom: { style: 'medium', color: { argb: ARGB.vino } } };
  hoja.getCell(`B${filaTablas}`).border = { bottom: { style: 'medium', color: { argb: ARGB.vino } } };

  hoja.mergeCells(`D${filaTablas}:E${filaTablas}`);
  const t2 = hoja.getCell(`D${filaTablas}`);
  t2.value = 'DISPOSITIVOS CON MAYOR ACTIVIDAD';
  t2.font = { bold: true, size: 10.5, color: { argb: ARGB.vino } };
  t2.alignment = { vertical: 'middle', horizontal: 'left' };
  t2.border = { bottom: { style: 'medium', color: { argb: ARGB.vino } } };
  hoja.getCell(`E${filaTablas}`).border = { bottom: { style: 'medium', color: { argb: ARGB.vino } } };

  // Subencabezados
  const filaSub = filaTablas + 1;
  hoja.getRow(filaSub).height = 18;

  const setSubHeader = (rango, texto, alineacion = 'left') => {
    const [c1, c2] = rango.split(':');
    if (c2) hoja.mergeCells(rango);
    const celda = hoja.getCell(c1);
    celda.value = texto;
    celda.font = { bold: true, size: 9, color: { argb: ARGB.grisTexto } };
    celda.alignment = { horizontal: alineacion, vertical: 'middle', indent: alineacion === 'left' ? 1 : 0 };
    celda.border = { bottom: { style: 'thin', color: { argb: ARGB.grisBorde } } };
    if (c2) hoja.getCell(c2).border = { bottom: { style: 'thin', color: { argb: ARGB.grisBorde } } };
  };

  setSubHeader('A12', 'Origen', 'left');
  setSubHeader('B12', 'Eventos', 'right');
  setSubHeader('D12', 'Dispositivo / IP', 'left');
  setSubHeader('E12', 'Eventos', 'right');

  // Datos
  const totalNVR    = eventos.filter(e => e.tipo_dispositivo === 'nvr').length;
  const totalCamara = eventos.filter(e => e.tipo_dispositivo === 'camara').length;
  const distribucion = [['Central NVR', totalNVR], ['Cámaras Locales', totalCamara]];

  const conteo = {};
  eventos.forEach(ev => { conteo[`${ev.nombre} (IP: ${ev.ip})`] = (conteo[`${ev.nombre} (IP: ${ev.ip})`] || 0) + 1; });
  const top5 = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const maxFilas = Math.max(distribucion.length, top5.length);
  const bordeDatos = { bottom: { style: 'thin', color: { argb: ARGB.grisBorde } } };

  for (let i = 0; i < maxFilas; i++) {
    const f = filaSub + 1 + i;
    hoja.getRow(f).height = 20;

    // Tabla Izquierda (Origen)
    if (distribucion[i]) {
      const cIzq = hoja.getCell(`A${f}`);
      const cDer = hoja.getCell(`B${f}`);
      cIzq.value = distribucion[i][0];
      cDer.value = distribucion[i][1];
      cIzq.font = cDer.font = { size: 10, color: { argb: ARGB.grisOscuro } };
      cIzq.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      cDer.alignment = { horizontal: 'right', vertical: 'middle' };
      cIzq.border = cDer.border = bordeDatos;
    }

    // Tabla Derecha (Dispositivos / IP)
    if (top5[i]) {
      const cIzq = hoja.getCell(`D${f}`);
      const cDer = hoja.getCell(`E${f}`);
      cIzq.value = top5[i][0];
      cDer.value = top5[i][1];
      cIzq.font = { size: 10, color: { argb: ARGB.grisOscuro } };
      cDer.font = { size: 10, bold: true, color: { argb: ARGB.grisOscuro } };
      cIzq.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      cDer.alignment = { horizontal: 'right', vertical: 'middle' };
      cIzq.border = cDer.border = bordeDatos;
    }
  }

  configurarImpresion(hoja, 'portrait', 5);
}

// ── Hoja 2: Historial Detallado (A4 Horizontal - Proporciones Óptimas) ──────
function agregarHojaHistorial(libro, eventos, descripcionFiltros) {
  const hoja = libro.addWorksheet('Historial Detallado');
  hoja.views = [{ state: 'frozen', ySplit: 6, showGridLines: false }];

  // Columnas proporcionales optimizadas para aprovechar todo el ancho horizontal
  hoja.columns = [
    { key: 'fecha',            width: 25 }, 
    { key: 'nombre',           width: 15 }, 
    { key: 'ip',               width: 20 }, 
    { key: 'tipo_dispositivo', width: 16 }, 
    { key: 'nvr_nombre',       width: 20 }, 
    { key: 'tipo',             width: 16 }, 
  ];

  // 1. ENCABEZADO INSTITUCIONAL
  hoja.getRow(1).height = 8;
  hoja.getRow(2).height = 22;
  hoja.getRow(3).height = 18;
  hoja.getRow(4).height = 16;
  hoja.getRow(5).height = 10; 

  hoja.mergeCells('B2:F2');
  const celdaTitulo = hoja.getCell('B2');
  celdaTitulo.value = 'HISTORIAL DE EVENTOS DE SEGURIDAD';
  celdaTitulo.font  = { bold: true, size: 15, color: { argb: ARGB.vino } };
  celdaTitulo.alignment = { vertical: 'middle', horizontal: 'left' };

  hoja.mergeCells('B3:F3');
  const celdaSub = hoja.getCell('B3');
  celdaSub.value = NOMBRE_HOSPITAL;
  celdaSub.font  = { bold: true, size: 10, color: { argb: ARGB.grisOscuro } };
  celdaSub.alignment = { vertical: 'middle', horizontal: 'left' };

  hoja.mergeCells('B4:F4');
  const celdaMeta = hoja.getCell('B4');
  celdaMeta.value = `Emisión: ${new Date().toLocaleString('es-CO')}   |   Filtros: ${descripcionFiltros}`;
  celdaMeta.font  = { size: 9, color: { argb: ARGB.grisTexto } };
  celdaMeta.alignment = { vertical: 'middle', horizontal: 'left' };

  for (let i = 1; i <= 6; i++) {
    hoja.getCell(`${String.fromCharCode(64 + i)}5`).border = { bottom: { style: 'medium', color: { argb: ARGB.vino } } };
  }

  if (bufferLogo) {
    const idImagen = libro.addImage({ buffer: bufferLogo, extension: 'png' });
    hoja.addImage(idImagen, { 
      tl: { col: 0.15, row: 1.1 }, 
      ext: { width: 54 * logoRatio, height: 54 } 
    });
  }

  // 2. TABLA DE DATOS (Encabezados centrados y alineados)
  const FILA_TABLA = 7; 
  const filaEncabezado = hoja.getRow(FILA_TABLA);
  ['Fecha y Hora', 'Dispositivo', 'Dirección IP', 'Tipo Equipo', 'NVR', 'Estado'].forEach((texto, i) => {
    const celda = filaEncabezado.getCell(i + 1);
    celda.value = texto;
    celda.font  = { bold: true, color: { argb: ARGB.blanco }, size: 9.5 };
    celda.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.vino } };
    // Centrar IP, Tipo Equipo y Estado; alinear a la izquierda con indentación el resto
    if (i === 2 || i === 3 || i === 5) {
      celda.alignment = { vertical: 'middle', horizontal: 'center' };
    } else {
      celda.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    }
  });
  filaEncabezado.height = 24;

  // 3. FILAS (Zebra formatting)
  const bordeInferiorFino = { bottom: { style: 'thin', color: { argb: ARGB.grisBorde } } };

  eventos.forEach((ev, idx) => {
    const esCaida = ev.tipo === 'caida';
    const fila = hoja.addRow({
      fecha:            new Date(ev.fecha),
      nombre:           ev.nombre,
      ip:               ev.ip,
      tipo_dispositivo: TEXTO_DISPOSITIVO[ev.tipo_dispositivo] || ev.tipo_dispositivo,
      nvr_nombre:       ev.nvr_nombre || 'N/A',
      tipo:             TEXTO_TIPO[ev.tipo] || ev.tipo,
    });

    const colorFondo = (idx % 2 === 0) ? ARGB.blanco : ARGB.grisFondo;

    fila.eachCell((celda, colIdx) => {
      celda.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFondo } };
      celda.border = bordeInferiorFino; 
      celda.font   = { size: 9.5, color: { argb: ARGB.grisOscuro } };
      
      if (colIdx === 3 || colIdx === 4 || colIdx === 6) { 
        celda.alignment = { vertical: 'middle', horizontal: 'center' };
      } else { 
        celda.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      }
    });

    fila.getCell('fecha').numFmt = 'dd/mm/yyyy, hh:mm:ss a/p. m.';
    fila.getCell('tipo').font = { bold: true, size: 9.5, color: { argb: esCaida ? ARGB.rojo : ARGB.verde } };
    fila.height = 20; 
  });

  hoja.autoFilter = { from: `A${FILA_TABLA}`, to: `F${FILA_TABLA}` };
  configurarImpresion(hoja, 'landscape', FILA_TABLA);
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF INSTITUCIONAL (Intacto y optimizado)
// ═══════════════════════════════════════════════════════════════════════════
function dibujarIconoTotal(doc, x, y, tam, color) {
  doc.fillColor(color);
  const alturas = [0.45, 0.7, 1];
  alturas.forEach((h, i) => {
    const bw = tam * 0.22;
    const bx = x + i * (bw + tam * 0.08);
    const bh = tam * h;
    doc.rect(bx, y + tam - bh, bw, bh).fill();
  });
}
function dibujarIconoCaida(doc, x, y, tam, color) {
  doc.fillColor(color);
  doc.circle(x + tam / 2, y + tam / 2, tam / 2).fill();
  doc.fillColor('#ffffff');
  doc.moveTo(x + tam * 0.3, y + tam * 0.35)
     .lineTo(x + tam * 0.7, y + tam * 0.35)
     .lineTo(x + tam * 0.5, y + tam * 0.72)
     .closePath().fill();
}
function dibujarIconoRecuperacion(doc, x, y, tam, color) {
  doc.fillColor(color);
  doc.circle(x + tam / 2, y + tam / 2, tam / 2).fill();
  doc.strokeColor('#ffffff').lineWidth(1.6).lineCap('round').lineJoin('round');
  doc.moveTo(x + tam * 0.28, y + tam * 0.52)
     .lineTo(x + tam * 0.45, y + tam * 0.68)
     .lineTo(x + tam * 0.74, y + tam * 0.32)
     .stroke();
}

export function generarPDFHistorial(eventos, descripcionFiltros = 'Sin filtros aplicados') {
  return new Promise((resolve, reject) => {
    const MARGEN = 40;
    const doc    = new PDFDocument({
      size:    'A4',
      layout:  'landscape',
      margins: { top: MARGEN, bottom: 20, left: MARGEN, right: MARGEN },
      bufferPages: true
    });
    
    const trozos = [];
    doc.on('data',  trozo => trozos.push(trozo));
    doc.on('end',   ()    => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);

    const xIzq       = MARGEN;
    const anchoUtil  = doc.page.width - MARGEN * 2;
    const yPiePagina = doc.page.height - 40;

    const altoLogo   = 50;
    const altoBanda  = 75;
    const yBanda     = doc.y;

    doc.rect(xIzq, yBanda, anchoUtil, altoBanda).fill(COLOR.blanco);
    doc.moveTo(xIzq, yBanda + altoBanda).lineTo(xIzq + anchoUtil, yBanda + altoBanda)
       .lineWidth(2).strokeColor(COLOR.vino).stroke();

    const yLogo  = yBanda + (altoBanda - altoLogo) / 2;
    let   xTexto = xIzq + 10;

    if (bufferLogo) {
      try {
        doc.image(bufferLogo, xIzq, yLogo, { height: altoLogo });
        xTexto = xIzq + altoLogo * logoRatio + 25;
      } catch (err) {
        console.error('No se pudo incrustar el logo en el PDF:', err.message);
      }
    }

    const anchoTexto = xIzq + anchoUtil - xTexto;
    
    doc.fontSize(16).font('Helvetica-Bold').fillColor(COLOR.vino)
      .text('Informe de Eventos de Seguridad', xTexto, yBanda + 12, { width: anchoTexto, lineBreak: false });
    
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR.grisOscuro)
      .text(NOMBRE_HOSPITAL, xTexto, yBanda + 34, { width: anchoTexto, lineBreak: false });
    
    doc.fontSize(8).font('Helvetica').fillColor(COLOR.grisTexto)
      .text(`Emisión: ${new Date().toLocaleString('es-CO')}   |   Filtros: ${descripcionFiltros}`, xTexto, yBanda + 52, { width: anchoTexto, lineBreak: false });

    doc.y = yBanda + altoBanda + 20;
    doc.x = xIzq;

    const totalCaidas      = eventos.filter(e => e.tipo === 'caida').length;
    const totalRecuperados = eventos.filter(e => e.tipo === 'recuperacion').length;
    const tarjetas = [
      { etiqueta: 'TOTAL EVENTOS',  valor: eventos.length,   color: COLOR.vino,  icono: dibujarIconoTotal },
      { etiqueta: 'CAÍDAS',         valor: totalCaidas,      color: COLOR.rojo,  icono: dibujarIconoCaida },
      { etiqueta: 'RECUPERACIONES', valor: totalRecuperados, color: COLOR.verde, icono: dibujarIconoRecuperacion },
    ];
    
    const gapTarjeta   = 15;
    const anchoTarjeta = (anchoUtil - gapTarjeta * (tarjetas.length - 1)) / tarjetas.length;
    const altoTarjeta  = 50;
    const yTarjetas    = doc.y;

    tarjetas.forEach((t, i) => {
      const x = xIzq + i * (anchoTarjeta + gapTarjeta);
      
      doc.roundedRect(x, yTarjetas, anchoTarjeta, altoTarjeta, 4).fillColor(COLOR.grisFondo).fill();
      doc.roundedRect(x, yTarjetas, 4, altoTarjeta, 2).fillColor(t.color).fill();
      doc.roundedRect(x, yTarjetas, anchoTarjeta, altoTarjeta, 4).lineWidth(0.5).strokeColor(COLOR.grisBorde).stroke();

      const tamIcono = 20;
      t.icono(doc, x + anchoTarjeta - tamIcono - 15, yTarjetas + (altoTarjeta - tamIcono) / 2, tamIcono, t.color);

      doc.fontSize(22).font('Helvetica-Bold').fillColor(t.color)
        .text(String(t.valor), x + 18, yTarjetas + 8, { width: anchoTarjeta - tamIcono - 36, lineBreak: false });
      doc.fontSize(8).font('Helvetica-Bold').fillColor(COLOR.grisTexto)
        .text(t.etiqueta, x + 18, yTarjetas + altoTarjeta - 18, { width: anchoTarjeta - tamIcono - 36, lineBreak: false });
    });

    doc.y = yTarjetas + altoTarjeta + 25;
    doc.x = xIzq;

    const columnas = [
      { titulo: 'Fecha y Hora',   ancho: 0.18 },
      { titulo: 'Dispositivo',    ancho: 0.22 },
      { titulo: 'Dirección IP',   ancho: 0.15 },
      { titulo: 'Tipo Equipo',    ancho: 0.15 },
      { titulo: 'NVR',            ancho: 0.17 },
      { titulo: 'Estado',         ancho: 0.13 },
    ];
    const anchos     = columnas.map(c => c.ancho * anchoUtil);
    const alturaFila = 20;

    function dibujarEncabezadoTabla(y) {
      doc.rect(xIzq, y, anchoUtil, alturaFila).fill(COLOR.vino);
      let x = xIzq;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR.blanco);
      columnas.forEach((col, i) => {
        doc.text(col.titulo, x + 6, y + 6, { width: anchos[i] - 12, lineBreak: false });
        x += anchos[i];
      });
      return y + alturaFila;
    }

    let y = dibujarEncabezadoTabla(doc.y);

    eventos.forEach((ev, i) => {
      if (y + alturaFila > yPiePagina - 15) {
        doc.addPage();
        y = dibujarEncabezadoTabla(MARGEN);
      }

      const esCaida = ev.tipo === 'caida';
      
      doc.rect(xIzq, y, anchoUtil, alturaFila)
        .fill(i % 2 === 0 ? COLOR.blanco : COLOR.grisFondo);
      
      doc.moveTo(xIzq, y + alturaFila).lineTo(xIzq + anchoUtil, y + alturaFila)
         .lineWidth(0.5).strokeColor(COLOR.grisBorde).stroke();

      const valores = [
        new Date(ev.fecha).toLocaleString('es-CO'),
        ev.nombre,
        ev.ip,
        TEXTO_DISPOSITIVO[ev.tipo_dispositivo] || ev.tipo_dispositivo,
        ev.nvr_nombre || 'N/A',
        TEXTO_TIPO[ev.tipo] || ev.tipo,
      ];

      let x = xIzq;
      doc.fontSize(8.5).font('Helvetica');
      
      valores.forEach((valor, idx) => {
        if (idx === valores.length - 1) {
          doc.font('Helvetica-Bold').fillColor(esCaida ? COLOR.rojo : COLOR.verde);
        } else {
          doc.font('Helvetica').fillColor(COLOR.grisOscuro);
        }
        
        doc.text(String(valor), x + 6, y + 6, { width: anchos[idx] - 12, lineBreak: false });
        x += anchos[idx];
      });

      y += alturaFila;
    });

    const rango = doc.bufferedPageRange();
    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);
      const yPie = yPiePagina;

      doc.moveTo(xIzq, yPie - 10).lineTo(xIzq + anchoUtil, yPie - 10)
        .lineWidth(1).strokeColor(COLOR.vino).stroke(); 

      doc.fontSize(8).font('Helvetica').fillColor(COLOR.grisTexto)
        .text('Documento formal generado por Sistema de Monitoreo NVR', xIzq, yPie, { width: anchoUtil / 2, lineBreak: false });
      
      doc.fontSize(8).font('Helvetica').fillColor(COLOR.grisTexto)
        .text(`Página ${i - rango.start + 1} de ${rango.count}`, xIzq, yPie, { width: anchoUtil, align: 'right', lineBreak: false });
    }

    doc.end();
  });
}