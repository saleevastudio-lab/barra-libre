import type { Workbook, Worksheet } from 'exceljs';
import type { CostLine, EventoDraft, Grupo } from './types';
import {
  MAX_EVENTOS_POR_GRUPO,
  MAX_INGRESOS,
  MAX_LINEAS_ESCANDALLO,
  TIPOS_SERVICIO,
  VARIOS_CONCEPTOS,
} from './catalog';

// La plantilla se carga en este orden:
//   1. public/plantilla-eventos.b64 (texto base64, solo en desarrollo local)
//   2. Supabase Storage (bucket público 'plantilla'): fuente de verdad en
//      producción, porque el binario xlsx no puede versionarse en el repo
//      (la API de GitHub solo acepta contenido de texto).
const TEMPLATE_URL = 'plantilla-eventos.b64';
const TEMPLATE_STORAGE_URL =
  'https://sowcvesivcrgfictgzrf.supabase.co/storage/v1/object/public/plantilla/plantilla-eventos.xlsx';

function toDate(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  const local = new Date(y, m - 1, d);
  // exceljs serializa la fecha con su instante UTC; la medianoche local en
  // zonas UTC+N queda como día anterior al truncar el serial. Desplazamos el
  // instante para que la medianoche UTC coincida con la fecha elegida.
  return new Date(local.getTime() - local.getTimezoneOffset() * 60000);
}

let templatePromise: Promise<ArrayBuffer> | null = null;
function loadTemplate(): Promise<ArrayBuffer> {
  if (!templatePromise) {
    templatePromise = fetch(TEMPLATE_URL).then(async (r) => {
      if (r.ok) {
        const b64 = await r.text();
        const bin = atob(b64.replace(/\s+/g, ''));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes.buffer;
      }
      // Sin .b64 local (producción): la plantilla vive en Supabase Storage.
      const res = await fetch(TEMPLATE_STORAGE_URL);
      if (!res.ok) throw new Error('No se pudo cargar la plantilla Excel');
      return res.arrayBuffer();
    });
  }
  return templatePromise;
}

/**
 * Genera el Excel del grupo: hoja Resumen con los datos del grupo y una
 * hoja "Evento N" por cada evento del borrador (la plantilla trae 8 hojas
 * idénticas; el Resumen marca las no usadas como "sin usar").
 *
 * Las fórmulas de la plantilla se conservan intactas y Excel/LibreOffice
 * recalculan al abrir (fullCalcOnLoad); los valores se muestran correctos
 * en cualquier visor aunque no recalcule.
 */
export async function generateExcel(
  grupo: Grupo,
  eventos: EventoDraft[],
): Promise<Blob> {
  const buf = await loadTemplate();
  const ExcelJS = await import('exceljs');
  const wb: Workbook = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  // ---------- Resumen (datos del grupo; todo lo demás se calcula solo) ----------
  const rs = wb.getWorksheet('Resumen');
  if (!rs) throw new Error('Plantilla inválida: falta la hoja Resumen');
  rs.getCell('B6').value = grupo.nombre || null;
  rs.getCell('D6').value = grupo.os || null;
  rs.getCell('I6').value = grupo.responsable || null;
  rs.getCell('L6').value = grupo.fechaAnalisis ? toDate(grupo.fechaAnalisis) : null;
  rs.getCell('B35').value = grupo.observaciones || null;

  // ---------- Eventos ----------
  eventos.slice(0, MAX_EVENTOS_POR_GRUPO).forEach((ev, i) => {
    const ws = wb.getWorksheet(`Evento ${i + 1}`);
    if (!ws) throw new Error(`Plantilla inválida: falta la hoja Evento ${i + 1}`);
    fillEvento(ws, ev);
  });

  wb.calcProperties.fullCalcOnLoad = true;

  const out = await wb.xlsx.writeBuffer();
  // ExcelJS no conserva gráficas al reescribir el libro: la doughnut
  // «Dónde va cada euro de venta neta» de la hoja Resumen se inyecta a
  // nivel de paquete (zip) copiándola desde la plantilla.
  const withChart = await injectResumenChart(out, buf);
  return new Blob([withChart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Ancla (posición/tamaño) de la doughnut en la hoja Resumen: columna L,
 *  fila 25, 3240000 × 1835999 EMU. Mismo sitio que en la plantilla. */
const CHART_FRAME =
  '<xdr:oneCellAnchor><xdr:from><xdr:col>11</xdr:col><xdr:colOff>0</xdr:colOff>' +
  '<xdr:row>24</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
  '<xdr:ext cx="3240000" cy="1835999" />' +
  '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="99" name="Dónde va cada euro" />' +
  '<xdr:cNvGraphicFramePr /></xdr:nvGraphicFramePr>' +
  '<xdr:xfrm><a:off x="0" y="0" /><a:ext cx="0" cy="0" /></xdr:xfrm>' +
  '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
  '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'r:id="rIdEuroChart" /></a:graphicData></a:graphic></xdr:graphicFrame>' +
  '<xdr:clientData /></xdr:oneCellAnchor>';

const CT_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CHART_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';

/**
 * ExcelJS conserva las imágenes de la hoja Resumen (el logo) pero descarta
 * las gráficas. Se reinyecta la doughnut «Dónde va cada euro de venta neta»
 * a nivel de paquete (zip): se copia chart1.xml de la plantilla y se añade
 * su ancla al drawing que el Resumen ya tiene, más la relación y el
 * content-type correspondientes. Los datos los lee de Q25:R29, que la
 * plantilla rellena sola con fórmulas (=MAX(0,D28)…).
 */
async function injectResumenChart(
  outBuf: ArrayBuffer,
  tplBuf: ArrayBuffer,
): Promise<ArrayBuffer> {
  const JSZip = (await import('jszip')).default;
  const gen = await JSZip.loadAsync(outBuf);
  const tpl = await JSZip.loadAsync(tplBuf);
  const chartPart = tpl.file('xl/charts/chart1.xml');
  if (!chartPart) return outBuf;

  // 1) Localizar la drawing del Resumen: hoja → sheetN.xml → rels → drawingN.xml.
  const workbookXml = await gen.file('xl/workbook.xml')?.async('string');
  const wbRelsXml = await gen.file('xl/_rels/workbook.xml.rels')?.async('string');
  const sheetRid = workbookXml?.match(/<sheet[^>]*name="Resumen"[^>]*r:id="([^"]+)"/)?.[1];
  const sheetTarget = sheetRid
    ? wbRelsXml?.match(
        new RegExp(`<Relationship[^>]*Id="${sheetRid}"[^>]*Target="([^"]+)"`),
      )?.[1]
    : undefined;
  const sheetPath = sheetTarget
    ? 'xl/' + sheetTarget.replace(/^\/xl\//, '').replace(/^\.\.\//, '')
    : 'xl/worksheets/sheet1.xml';
  const sheetXml = (await gen.file(sheetPath)?.async('string')) ?? '';
  const sheetRidDraw = sheetXml.match(/<drawing r:id="([^"]+)"/)?.[1];
  if (!sheetRidDraw) return outBuf; // el Resumen no tiene drawing (no debería pasar)

  const sheetRelsPath =
    sheetPath.replace('xl/worksheets/', 'xl/worksheets/_rels/') + '.rels';
  const sheetRelsXml = (await gen.file(sheetRelsPath)?.async('string')) ?? '';
  const drawTarget = sheetRelsXml.match(
    new RegExp(`<Relationship[^>]*Id="${sheetRidDraw}"[^>]*Target="([^"]+)"`),
  )?.[1];
  if (!drawTarget) return outBuf;
  const drawingPath = 'xl/drawings/' + drawTarget.replace(/^\.\.\//, '').split('/').pop();
  const drawingRelsPath = 'xl/drawings/_rels/' + drawingPath.split('/').pop() + '.rels';

  // 2) Ancla de la gráfica dentro de la drawing existente.
  let drawingXml = (await gen.file(drawingPath)?.async('string')) ?? '';
  if (!drawingXml.includes('</xdr:wsDr>')) return outBuf;
  drawingXml = drawingXml.replace('</xdr:wsDr>', CHART_FRAME + '</xdr:wsDr>');
  gen.file(drawingPath, drawingXml);

  // 3) Relación drawing → chart.
  let drawingRels = (await gen.file(drawingRelsPath)?.async('string')) ?? '';
  if (!drawingRels.includes('charts/chart1.xml')) {
    if (!drawingRels) {
      drawingRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${CT_REL}"></Relationships>`;
    }
    drawingRels = drawingRels.replace(
      '</Relationships>',
      `<Relationship Id="rIdEuroChart" Type="${CHART_REL}" Target="../charts/chart1.xml"/></Relationships>`,
    );
    gen.file(drawingRelsPath, drawingRels);
  }

  // 4) La parte del chart, copiada de la plantilla tal cual.
  gen.file('xl/charts/chart1.xml', await chartPart.async('nodebuffer'));

  // 5) Content type del chart.
  const ctPath = '[Content_Types].xml';
  const ct = (await gen.file(ctPath)?.async('string')) ?? '';
  if (ct && !ct.includes('PartName="/xl/charts/chart1.xml"')) {
    gen.file(
      ctPath,
      ct.replace(
        '</Types>',
        '<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>',
      ),
    );
  }

  return (await gen.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })) as ArrayBuffer;
}

function fillEvento(ws: Worksheet, ev: EventoDraft): void {
  // Cabecera: nombre, tipo (etiqueta oficial de Parámetros), fecha, duración, mesas
  const tipoFull = TIPOS_SERVICIO.find((t) => t.short === ev.tipo)?.full;
  ws.getCell('B6').value = ev.nombre || null;
  ws.getCell('C6').value = tipoFull ?? (ev.tipo || null);
  ws.getCell('G6').value = ev.fecha ? toDate(ev.fecha) : null;
  ws.getCell('H6').value = ev.duracion || null;
  ws.getCell('I6').value = ev.mesas || null;

  // 1 · Ingresos (filas 14-19): concepto, categoría, pax/PVP adultos y niños, IVA
  for (let i = 0; i < MAX_INGRESOS; i++) {
    const r = 14 + i;
    const l = ev.ingresos[i];
    if (!l) {
      for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H']) {
        ws.getCell(`${col}${r}`).value = null;
      }
      continue;
    }
    ws.getCell(`B${r}`).value = l.concepto || null;
    ws.getCell(`C${r}`).value = l.categoria || null;
    ws.getCell(`D${r}`).value = l.paxAdultos || null;
    ws.getCell(`E${r}`).value = l.pvpAdulto || null;
    ws.getCell(`F${r}`).value = l.paxNinos || null;
    ws.getCell(`G${r}`).value = l.pvpNino || null;
    // H vacío = IVA por defecto (10%); se escribe solo si se eligió otro.
    ws.getCell(`H${r}`).value = l.iva !== null && l.iva !== undefined ? l.iva : null;
  }

  // 2/3 · Escandallos: comida filas 24-48, bebida filas 53-77
  fillEscandallo(ws, 24, ev.comida);
  fillEscandallo(ws, 53, ev.bebida);

  // 4 · Personal (horas en C82:C85; el coste €/h viene de Parámetros)
  ws.getCell('C82').value = ev.personal.extraSala || null;
  ws.getCell('C83').value = ev.personal.internoSala || null;
  ws.getCell('C84').value = ev.personal.extraCocina || null;
  ws.getCell('C85').value = ev.personal.internoCocina || null;

  // 5 · Costes varios (filas 90-98, conceptos fijos de la plantilla)
  for (let i = 0; i < VARIOS_CONCEPTOS.length; i++) {
    const r = 90 + i;
    const v = ev.varios[i];
    ws.getCell(`C${r}`).value = v?.cantidad || null;
    ws.getCell(`D${r}`).value = v?.costeUnitario || null;
  }
}

/**
 * Escribe un escandallo en las filas del bloque. La columna D se rellena
 * sola desde el Catálogo cuando el nombre existe; la E ("coste manual") solo
 * se usa cuando el artículo no está en el catálogo o hay coste propio.
 * El coste siempre se guarda por UNIDAD (la app lo toma así del catálogo);
 * las líneas en caja (×24) solo cambian el conteo: cantidad × 24 unidades
 * con el mismo coste unitario.
 */
function fillEscandallo(
  ws: Worksheet,
  startRow: number,
  lineas: CostLine[],
): void {
  for (let i = 0; i < MAX_LINEAS_ESCANDALLO; i++) {
    const r = startRow + i;
    const l = lineas[i];
    if (!l) {
      ws.getCell(`B${r}`).value = null;
      ws.getCell(`C${r}`).value = null;
      ws.getCell(`E${r}`).value = null;
      continue;
    }
    const esCaja = Boolean(l.esCaja);
    ws.getCell(`B${r}`).value = l.nombre || null;
    ws.getCell(`C${r}`).value = esCaja ? l.cantidad * 24 : l.cantidad || null;
    ws.getCell(`E${r}`).value =
      l.coste !== null && l.coste !== undefined ? l.coste : null;
  }
}

/** Nombre del archivo al descargarlo: GRUPO.xlsx en mayúsculas. */
export function excelFileName(grupo: Grupo): string {
  return `${grupo.nombre?.trim() || 'GRUPO'}.xlsx`.toUpperCase();
}
