// ── Servicio de exportación del historial (Excel y PDF) ───────────────────────
import ExcelJS  from 'exceljs';
import PDFDocument from 'pdfkit';

// ── Traducciones para que el archivo se lea en español, no en claves internas ─
const TEXTO_TIPO = { caida: 'Caída', recuperacion: 'Recuperación' };
const TEXTO_DISPOSITIVO = { nvr: 'NVR', camara: 'Cámara' };

// ── Generar el archivo Excel ──────────────────────────────────────────────────
export async function generarExcelHistorial(eventos) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'NVR Monitor HIC';
  libro.created = new Date();

  // ═══ Hoja 1: Historial de Eventos ═══════════════════════════════════════════
  const hoja = libro.addWorksheet('Historial de Eventos', {
    views: [{ state: 'frozen', ySplit: 1 }] // Congela la fila del encabezado al hacer scroll
  });

  hoja.columns = [
    { header: 'Fecha',            key: 'fecha',            width: 22 },
    { header: 'Dispositivo',      key: 'nombre',           width: 22 },
    { header: 'IP',               key: 'ip',               width: 16 },
    { header: 'Tipo Dispositivo', key: 'tipo_dispositivo', width: 16 },
    { header: 'NVR',              key: 'nvr_nombre',       width: 22 },
    { header: 'Evento',           key: 'tipo',             width: 16 },
  ];

  // Encabezado con el color de marca (ámbar), en negrita, con borde
  const filaEncabezado = hoja.getRow(1);
  filaEncabezado.font   = { bold: true, color: { argb: 'FF1A1300' }, size: 11 };
  filaEncabezado.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4A017' } };
  filaEncabezado.alignment = { vertical: 'middle', horizontal: 'center' };
  filaEncabezado.height = 22;

  const bordeFino = { style: 'thin', color: { argb: 'FFDDDDDD' } };

  eventos.forEach(ev => {
    const esCaida = ev.tipo === 'caida';
    const fila = hoja.addRow({
      fecha:            new Date(ev.fecha), // Fecha real, no texto: se puede ordenar/filtrar en Excel
      nombre:           ev.nombre,
      ip:               ev.ip,
      tipo_dispositivo: TEXTO_DISPOSITIVO[ev.tipo_dispositivo] || ev.tipo_dispositivo,
      nvr_nombre:       ev.nvr_nombre || '—',
      tipo:             TEXTO_TIPO[ev.tipo] || ev.tipo,
    });

    fila.eachCell(celda => {
      celda.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: esCaida ? 'FFFCE8E8' : 'FFE8F8EE' } };
      celda.border  = { top: bordeFino, bottom: bordeFino, left: bordeFino, right: bordeFino };
    });

    // Fecha con formato legible de Excel (no como texto)
    fila.getCell('fecha').numFmt = 'dd/mm/yyyy hh:mm';

    // Columnas IP / Tipo Dispositivo / Evento centradas; Evento en negrita y coloreado
    ['ip', 'tipo_dispositivo', 'tipo'].forEach(key => {
      fila.getCell(key).alignment = { horizontal: 'center' };
    });
    fila.getCell('tipo').font = { bold: true, color: { argb: esCaida ? 'FFB91C1C' : 'FF15803D' } };
  });

  // Filtro automático (flechitas desplegables) en el encabezado, para filtrar
  // directamente dentro de Excel sin tocar la web
  hoja.autoFilter = { from: 'A1', to: 'F1' };

  // ═══ Hoja 2: Resumen ═════════════════════════════════════════════════════════
  agregarHojaResumen(libro, eventos);

  return libro.xlsx.writeBuffer();
}

// ── Hoja de resumen con totales, útil para un reporte rápido ─────────────────
function agregarHojaResumen(libro, eventos) {
  const hoja = libro.addWorksheet('Resumen');
  hoja.getColumn(1).width = 30;
  hoja.getColumn(2).width = 14;

  const totalCaidas       = eventos.filter(e => e.tipo === 'caida').length;
  const totalRecuperados  = eventos.filter(e => e.tipo === 'recuperacion').length;
  const totalNVR          = eventos.filter(e => e.tipo_dispositivo === 'nvr').length;
  const totalCamara       = eventos.filter(e => e.tipo_dispositivo === 'camara').length;

  // Top 5 dispositivos con más eventos, para detectar rápido cuál está más problemático
  const conteoPorDispositivo = {};
  eventos.forEach(ev => {
    const clave = `${ev.nombre} (${ev.ip})`;
    conteoPorDispositivo[clave] = (conteoPorDispositivo[clave] || 0) + 1;
  });
  const top5 = Object.entries(conteoPorDispositivo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const titulo = hoja.getCell('A1');
  titulo.value = 'Resumen — Historial de Eventos';
  titulo.font  = { bold: true, size: 14, color: { argb: 'FFD4A017' } };
  hoja.mergeCells('A1:B1');

  hoja.getCell('A2').value = `Generado: ${new Date().toLocaleString('es-CO')}`;
  hoja.getCell('A2').font  = { italic: true, color: { argb: 'FF666666' }, size: 9 };

  const filasResumen = [
    ['', ''],
    ['Total de eventos',            eventos.length],
    ['Total caídas',                totalCaidas],
    ['Total recuperaciones',        totalRecuperados],
    ['Eventos de NVR',              totalNVR],
    ['Eventos de cámaras',          totalCamara],
    ['', ''],
    ['Dispositivos con más eventos', ''],
  ];

  filasResumen.forEach(([etiqueta, valor]) => {
    const fila = hoja.addRow([etiqueta, valor]);
    if (etiqueta && valor !== '') fila.getCell(1).font = { bold: true };
  });

  top5.forEach(([nombre, cantidad]) => {
    hoja.addRow([`  ${nombre}`, cantidad]);
  });
}

// ── Generar el archivo PDF ─────────────────────────────────────────────────────
export function generarPDFHistorial(eventos, descripcionFiltros = 'Sin filtros aplicados') {
  return new Promise((resolve, reject) => {
    const doc     = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const trozos  = [];
    doc.on('data',  trozo => trozos.push(trozo));
    doc.on('end',   ()    => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);

    const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ── Encabezado del reporte ───────────────────────────────────────────────
    doc.fontSize(16).fillColor('#1a1a1a').text('NVR Monitor HIC — Historial de Eventos', { align: 'left' });
    doc.fontSize(9).fillColor('#666666')
      .text(`Generado: ${new Date().toLocaleString('es-CO')}`)
      .text(`Filtros: ${descripcionFiltros}`)
      .text(`Total de eventos: ${eventos.length}`);
    doc.moveDown(0.5);

    // ── Tabla ─────────────────────────────────────────────────────────────────
    const columnas = [
      { titulo: 'Fecha',        ancho: 0.20 },
      { titulo: 'Dispositivo',  ancho: 0.22 },
      { titulo: 'IP',           ancho: 0.15 },
      { titulo: 'Tipo Disp.',   ancho: 0.13 },
      { titulo: 'NVR',          ancho: 0.17 },
      { titulo: 'Evento',       ancho: 0.13 },
    ];
    const anchos = columnas.map(c => c.ancho * anchoUtil);
    const alturaFila = 18;

    function dibujarEncabezadoTabla(y) {
      doc.rect(doc.page.margins.left, y, anchoUtil, alturaFila).fill('#1a1a1a');
      let x = doc.page.margins.left;
      doc.fontSize(8.5).fillColor('#ffffff');
      columnas.forEach((col, i) => {
        doc.text(col.titulo, x + 4, y + 5, { width: anchos[i] - 8, lineBreak: false });
        x += anchos[i];
      });
      return y + alturaFila;
    }

    let y = dibujarEncabezadoTabla(doc.y);

    eventos.forEach((ev, i) => {
      // Salto de página si ya no cabe otra fila
      if (y + alturaFila > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = dibujarEncabezadoTabla(doc.page.margins.top);
      }

      const esCaida = ev.tipo === 'caida';
      doc.rect(doc.page.margins.left, y, anchoUtil, alturaFila)
        .fill(i % 2 === 0 ? '#fafafa' : '#f0f0f0');

      const valores = [
        new Date(ev.fecha).toLocaleString('es-CO'),
        ev.nombre,
        ev.ip,
        TEXTO_DISPOSITIVO[ev.tipo_dispositivo] || ev.tipo_dispositivo,
        ev.nvr_nombre || '—',
        TEXTO_TIPO[ev.tipo] || ev.tipo,
      ];

      let x = doc.page.margins.left;
      doc.fontSize(8).fillColor(esCaida ? '#b91c1c' : '#15803d');
      valores.forEach((valor, idx) => {
        doc.text(String(valor), x + 4, y + 5, { width: anchos[idx] - 8, lineBreak: false });
        x += anchos[idx];
      });

      y += alturaFila;
    });

    doc.end();
  });
}