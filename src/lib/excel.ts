import type { Drink, EventData, OrderLine } from './types';
import type { Workbook, Worksheet, Cell } from 'exceljs';

// La plantilla viaja como texto base64 (.b64) para poder publicarse en
// GitHub Pages sin depender de binarios; se decodifica aquí en el cliente.
const TEMPLATE_URL = 'barra-libre-template.b64';

function toDate(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  const local = new Date(y, m - 1, d);
  // exceljs serializa la fecha con su instante UTC; la medianoche local en
  // zonas UTC+N queda como día anterior al truncar el serial. Desplazamos el
  // instante para que la medianoche UTC coincida con la fecha elegida.
  return new Date(local.getTime() - local.getTimezoneOffset() * 60000);
}

const roundDown2 = (x: number) => Math.floor(x * 100) / 100;

let templatePromise: Promise<ArrayBuffer> | null = null;
function loadTemplate(): Promise<ArrayBuffer> {
  if (!templatePromise) {
    templatePromise = fetch(TEMPLATE_URL)
      .then((r) => {
        if (!r.ok) throw new Error('No se pudo cargar la plantilla Excel');
        return r.text();
      })
      .then((b64) => {
        const bin = atob(b64.replace(/\s+/g, ''));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes.buffer;
      });
  }
  return templatePromise;
}

/**
 * Genera el libro "Barra libre" completo (las 9 hojas del original) con la
 * consumición del evento rellenada en la hoja "Bebida" y los datos
 * económicos en "Análisis".
 *
 * Las fórmulas originales se conservan y, además, se les adjunta el
 * resultado calculado: así el archivo muestra los valores correctos en
 * cualquier visor (incluidos los que no recalculan fórmulas) y Excel /
 * LibreOffice los recalculan al abrirlo igualmente.
 */
export async function generateExcel(
  event: EventData,
  lines: OrderLine[],
  drinks: Drink[],
): Promise<Blob> {
  const buf = await loadTemplate();
  const ExcelJS = await import('exceljs');
  const wb: Workbook = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const byId = new Map(drinks.map((d) => [d.id, d]));
  const used = lines.filter((l) => l.qty > 0 && byId.has(l.drinkId));

  // ---------- Cálculos (replican la lógica de las fórmulas del libro) ----------
  // Fidelidad con los P&L reales: los niños se facturan en la hoja Bebida
  // (E7/F7 → G7/J7/J8 y el bloque de ratios), pero el desglose de Análisis
  // solo ingresa los adultos (D19 = G13·D13 = PVP adultos × adultos).
  const comensales = event.comensales || 0;
  const pvp = event.pvp || 0;
  const ninos = event.ninos || 0;
  const pvpNinos = event.pvpNinos || 0;
  const g6 = comensales * pvp; // =E6*F6 (adultos)
  const g7 = ninos * pvpNinos; // =E7*F7 (niños)
  const g8 = g6 + g7; // =SUM(G6:G7)
  const j6 = roundDown2(g6); // ROUNDDOWN(G6·100%)
  const j7 = roundDown2(g7);
  const j8 = j6 + j7; // =SUM(J6:J7)
  const netaBebida = j8 / 1.1; // I48 (J8/1.1)

  const bruta = g6; // D19/D20 (adultos, según la plantilla)
  const neta = bruta / 1.1; // D21

  const totalCoste = used.reduce((acc, l) => {
    const d = byId.get(l.drinkId)!;
    return acc + l.qty * d.unitCost;
  }, 0);

  const socialSalaExtra = event.horasExtraSala * event.rateExtra;
  const socialSalaInterno = event.horasPersonalSala * event.rateInterno;
  const socialCocinaExtra = event.horasExtraCocina * event.rateExtra;
  const socialCocinaInterno = event.horasPersonalCocina * event.rateInterno;
  const costeSocial =
    socialSalaExtra + socialSalaInterno + socialCocinaExtra + socialCocinaInterno;

  // Costes varios: unidad × coste de cada línea (Análisis E46:F52)
  const variosLines: [number, number][] = [
    [event.lavanderiaUnd, event.lavanderiaCoste],
    [event.decoracionMesas, event.decoracionCoste],
    [event.climatizacionHoras, event.climatizacionCoste],
    [event.iluminacionHoras, event.iluminacionCoste],
    [event.imprentaPersonas, event.imprentaCoste],
    [event.dotacionUnd, event.dotacionCoste],
    [event.auxiliaresUnd, event.auxiliaresCoste],
  ];
  const variosD = variosLines.map(([u, c]) => (u || 0) * (c || 0));
  const costesVarios = variosD.reduce((a, b) => a + b, 0);
  const costeTotal = totalCoste + costeSocial + costesVarios;
  const beneficio = neta - costeTotal;

  const ratioReal = netaBebida > 0 ? totalCoste / netaBebida : 0; // I50
  const ratioPpto = totalCoste > 0 ? ratioReal / totalCoste : 0; // I51
  const ratioDiff = ratioReal - ratioPpto; // I52

  // ---------- Hoja Bebida ----------
  const ws = wb.getWorksheet('Bebida');
  if (!ws) throw new Error('Plantilla inválida: falta la hoja Bebida');

  // Copia de estilos "maestros" de la fila de artículos (14) para filas vacías
  const masterStyle = (col: string) => {
    const c = ws.getCell(`${col}14`);
    return c.style ? JSON.parse(JSON.stringify(c.style)) : {};
  };
  const stQty = masterStyle('B');
  const stName = masterStyle('C');
  const stCost = masterStyle('I');
  const stTot = masterStyle('J');

  // La cabecera (Fecha/Nº OS/Modalidad, fila 3) se deja vacía: así lo hacen
  // los managers en los P&L reales (la fecha y el nombre van en Análisis D6/D7).
  // Facturación: adultos (E6 × F6) y niños (E7 × F7), como en los archivos reales
  ws.getCell('E6').value = comensales || null;
  ws.getCell('F6').value = pvp || null;
  ws.getCell('E7').value = ninos > 0 ? ninos : null;
  ws.getCell('F7').value = ninos > 0 ? pvpNinos : null;

  // Limpia las 32 filas de artículos (14–45) y escribe las líneas del pedido
  for (let r = 14; r <= 45; r++) {
    const qty = ws.getCell(`B${r}`);
    const name = ws.getCell(`C${r}`);
    const cost = ws.getCell(`I${r}`);
    qty.value = null;
    name.value = null;
    cost.value = null;
    qty.style = JSON.parse(JSON.stringify(stQty));
    name.style = JSON.parse(JSON.stringify(stName));
    cost.style = JSON.parse(JSON.stringify(stCost));
    const tot = ws.getCell(`J${r}`);
    tot.value = { formula: `B${r}*I${r}`, result: 0 };
    tot.style = JSON.parse(JSON.stringify(stTot));
  }

  used.slice(0, 32).forEach((l, i) => {
    const d = byId.get(l.drinkId)!;
    const r = 14 + i;
    ws.getCell(`B${r}`).value = l.qty;
    ws.getCell(`C${r}`).value = d.name;
    ws.getCell(`I${r}`).value = d.unitCost;
    ws.getCell(`J${r}`).value = { formula: `B${r}*I${r}`, result: l.qty * d.unitCost };
  });

  // Resultados de las fórmulas de la hoja Bebida
  setResult(ws, 'G6', g6); // =E6*F6
  setResult(ws, 'I6', 0); // clave 6 → 0% comida
  setResult(ws, 'J6', j6);
  setResult(ws, 'G7', g7); // =E7*F7
  setResult(ws, 'I7', 0);
  setResult(ws, 'J7', j7);
  setResult(ws, 'G8', g8); // =SUM(G6:G7)
  setResult(ws, 'I8', 0);
  setResult(ws, 'J8', j8); // =SUM(J6:J7)
  setResult(ws, 'J46', totalCoste); // =SUM(J14:J45)
  setResult(ws, 'I48', netaBebida); // =J8/1.1
  setResult(ws, 'I49', totalCoste); // =J46
  setResult(ws, 'I50', ratioReal);
  setResult(ws, 'I51', ratioPpto);
  setResult(ws, 'I52', ratioDiff);
  setResult(ws, 'J52', ratioDiff > 0 ? '¡¡DESVIACIÓN!!' : '');

  // ---------- Hoja Análisis ----------
  const an = wb.getWorksheet('Análisis');
  if (an) {
    an.getCell('D6').value = toDate(event.fecha);
    an.getCell('D7').value = event.grupo || '—';

    // Coste social: horas editables. Las tarifas F38:F41 conservan las
    // fórmulas =25*1.32 / =16*1.32 de la plantilla mientras sean las
    // estándar; con tarifas personalizadas se escriben como valor plano.
    an.getCell('E38').value = event.horasExtraSala || 0;
    an.getCell('E39').value = event.horasPersonalSala || 0;
    an.getCell('E40').value = event.horasExtraCocina || 0;
    an.getCell('E41').value = event.horasPersonalCocina || 0;
    const RATE_EXTRA_STD = 33; // 25 × 1,32
    const RATE_INTERNO_STD = 21.12; // 16 × 1,32
    const stdRates =
      Math.abs((event.rateExtra || 0) - RATE_EXTRA_STD) < 0.005 &&
      Math.abs((event.rateInterno || 0) - RATE_INTERNO_STD) < 0.005;
    if (!stdRates) {
      an.getCell('F38').value = event.rateExtra || 0;
      an.getCell('F39').value = event.rateInterno || 0;
      an.getCell('F40').value = event.rateExtra || 0;
      an.getCell('F41').value = event.rateInterno || 0;
    }

    // Costes varios (Análisis E46:F52): cada línea unidades × coste unitario.
    // Las líneas sin uso quedan vacías, como en los P&L reales.
    const eCol = ['E46', 'E47', 'E48', 'E49', 'E50', 'E51', 'E52'];
    const fCol = ['F46', 'F47', 'F48', 'F49', 'F50', 'F51', 'F52'];
    variosLines.forEach(([u, c], i) => {
      const used = (u || 0) > 0 || (c || 0) > 0;
      an.getCell(eCol[i]).value = used ? u || 0 : null;
      an.getCell(fCol[i]).value = used ? c || 0 : null;
    });

    if (event.observaciones) {
      an.getCell('D55').value = event.observaciones;
    }

    // Resultados de las fórmulas de la hoja Análisis
    const pct = (x: number) => (neta > 0 ? x : null); // null → '' en % sobre netas
    // D11: en la plantilla base llega como constante (resto del ejemplo
    // original); los P&L reales llevan la fórmula =Comida!$E$6 → se restaura.
    const d11 = an.getCell('D11');
    const d11v = d11.value as { formula?: string } | null;
    if (!d11v || typeof d11v !== 'object' || typeof d11v.formula !== 'string') {
      d11.value = { formula: 'Comida!$E$6', result: 0 };
    } else {
      setResult(an, 'D11', 0);
    }
    setResult(an, 'E11', 0);
    setResult(an, 'G11', 0);
    setResult(an, 'D12', 0);
    setResult(an, 'E12', 0);
    setResult(an, 'G12', 0);
    setResult(an, 'D13', comensales);
    setResult(an, 'G13', pvp);
    for (const r of [16, 17, 18]) {
      setResult(an, `D${r}`, 0);
      setResult(an, `E${r}`, bruta > 0 ? 0 : '');
      setResult(an, `F${r}`, 0);
      setResult(an, `G${r}`, '');
      setResult(an, `H${r}`, 0);
    }
    setResult(an, 'I16', beneficio);
    setResult(an, 'D19', bruta);
    setResult(an, 'E19', bruta > 0 ? 1 : '');
    setResult(an, 'G19', bruta > 0 ? j6 / bruta : '');
    setResult(an, 'H19', j6); // =Bebida!J6 (adultos)
    setResult(an, 'D20', bruta);
    setResult(an, 'E20', bruta > 0 ? 1 : '');
    setResult(an, 'F20', 0);
    setResult(an, 'H20', j6);
    setResult(an, 'D21', neta);
    setResult(an, 'D22', costeTotal);
    setResult(an, 'E22', pct(costeTotal / neta) ?? '');
    setResult(an, 'D23', beneficio);
    setResult(an, 'E23', bruta > 0 ? beneficio / bruta : '');
    for (const r of [27, 28, 29, 30, 31, 32]) {
      setResult(an, `D${r}`, 0);
      setResult(an, `E${r}`, '');
    }
    setResult(an, 'D33', totalCoste);
    setResult(an, 'E33', j6 > 0 ? (totalCoste / (j6 / 1.1)) * 100 : 0);
    setResult(an, 'D34', totalCoste);
    setResult(an, 'E34', pct((totalCoste / neta) * 100) ?? '');
    setResult(an, 'I27', totalCoste);
    setResult(an, 'I28', neta > 0 ? totalCoste / neta : 0);
    setResult(an, 'D38', socialSalaExtra);
    setResult(an, 'D39', socialSalaInterno);
    setResult(an, 'D40', socialCocinaExtra);
    setResult(an, 'D41', socialCocinaInterno);
    setResult(an, 'D42', costeSocial);
    setResult(an, 'F42', pct((costeSocial / neta) * 100) ?? '');
    setResult(an, 'I38', costeSocial);
    setResult(an, 'I39', neta > 0 ? costeSocial / neta : 0);
    setResult(an, 'D46', variosD[0]);
    for (let i = 1; i < 7; i++) {
      setResult(an, `D${46 + i}`, variosD[i]);
    }
    setResult(an, 'D53', costesVarios);
    setResult(an, 'F53', pct((costesVarios / neta) * 100) ?? '');
    setResult(an, 'I46', costesVarios);
    setResult(an, 'I47', neta > 0 ? costesVarios / neta : 0);
  }

  // Fuerza el recálculo completo al abrir el archivo en Excel / LibreOffice
  wb.calcProperties.fullCalcOnLoad = true;

  const out = await wb.xlsx.writeBuffer();
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Adjunta un resultado calculado a una celda con fórmula (si la tiene). */
function setResult(ws: Worksheet, addr: string, result: number | string) {
  const cell: Cell = ws.getCell(addr);
  const v = cell.value as { formula?: string } | null;
  if (v && typeof v === 'object' && typeof v.formula === 'string') {
    cell.value = { formula: v.formula, result };
  } else if (result !== '' && result !== 0) {
    // La celda no tenía fórmula (plantilla modificada): escribe el valor
    cell.value = result;
  } else if (result === 0 && (v === null || v === undefined)) {
    cell.value = 0;
  }
}

export function excelFileName(event: EventData): string {
  const os = event.os?.trim() || 'SIN-OS';
  return `Barra libre — ${os} — ${event.fecha}.xlsx`;
}
