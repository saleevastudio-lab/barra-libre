import type { Drink, EventData, OrderLine, TelegramSettings } from './types';

export interface SummaryNumbers {
  totalCoste: number;
  facturacionBruta: number;
  facturacionNeta: number;
  costeSocial: number;
  costesVarios: number;
  beneficio: number;
  pctCoste: number; // coste bebida / venta neta
}

export function computeSummary(
  event: EventData,
  lines: OrderLine[],
  drinks: Drink[],
): SummaryNumbers {
  const byId = new Map(drinks.map((d) => [d.id, d]));
  const totalCoste = lines.reduce((acc, l) => {
    const d = byId.get(l.drinkId);
    return d ? acc + l.qty * d.unitCost : acc;
  }, 0);
  const facturacionBruta =
    (event.comensales || 0) * (event.pvp || 0) +
    (event.ninos || 0) * (event.pvpNinos || 0);
  const facturacionNeta = facturacionBruta / 1.1;
  const costeSocial =
    event.horasExtraSala * event.rateExtra +
    event.horasPersonalSala * event.rateInterno +
    event.horasExtraCocina * event.rateExtra +
    event.horasPersonalCocina * event.rateInterno;
  const costesVarios =
    event.lavanderiaUnd * event.lavanderiaCoste +
    event.decoracionMesas * event.decoracionCoste +
    event.climatizacionHoras * event.climatizacionCoste +
    event.iluminacionHoras * event.iluminacionCoste +
    event.imprentaPersonas * event.imprentaCoste +
    event.dotacionUnd * event.dotacionCoste +
    event.auxiliaresUnd * event.auxiliaresCoste;
  const beneficio = facturacionNeta - totalCoste - costeSocial - costesVarios;
  const pctCoste = facturacionNeta > 0 ? totalCoste / facturacionNeta : 0;
  return {
    totalCoste,
    facturacionBruta,
    facturacionNeta,
    costeSocial,
    costesVarios,
    beneficio,
    pctCoste,
  };
}

const fmtEUR = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});
const fmtPCT = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildTelegramMessage(
  event: EventData,
  lines: OrderLine[],
  drinks: Drink[],
): string {
  const byId = new Map(drinks.map((d) => [d.id, d]));
  const used = lines.filter((l) => l.qty > 0 && byId.has(l.drinkId));
  const s = computeSummary(event, lines, drinks);

  const fechaES = new Date(event.fecha + 'T00:00:00').toLocaleDateString(
    'es-ES',
    { day: '2-digit', month: '2-digit', year: 'numeric' },
  );

  const head = [
    `<b>CONSUMICIÓN DE EVENTO — ${esc((event.tipoServicio || 'Barra libre').toUpperCase())}</b>`,
    ``,
    `<b>Fecha:</b> ${esc(fechaES)}   <b>Nº OS:</b> ${esc(event.os || '—')}`,
    `<b>Grupo / evento:</b> ${esc(event.grupo || '—')}`,
    `<b>Comensales adultos:</b> ${event.comensales} × ${fmtEUR.format(event.pvp)}${event.ninos > 0 ? ` + ${event.ninos} niños × ${fmtEUR.format(event.pvpNinos)}` : ''} = <b>${fmtEUR.format(s.facturacionBruta)}</b>`,
    ``,
    `<b>Consumo (${used.length} artículos):</b>`,
  ];

  const items = used.map((l) => {
    const d = byId.get(l.drinkId)!;
    const line = l.qty * d.unitCost;
    const box = d.unit === 'caja' ? ' (caja)' : '';
    return `${l.qty}× ${esc(d.name)}${box} — ${fmtEUR.format(line)}`;
  });

  const foot = [
    ``,
    `<b>Total coste bebida:</b> ${fmtEUR.format(s.totalCoste)}`,
    `<b>Facturación neta (sin IVA):</b> ${fmtEUR.format(s.facturacionNeta)}`,
    `<b>% coste bebida / venta neta:</b> ${fmtPCT.format(s.pctCoste)}`,
    `<b>Coste social:</b> ${fmtEUR.format(s.costeSocial)} (sala ${event.horasExtraSala + event.horasPersonalSala}h · cocina ${event.horasExtraCocina + event.horasPersonalCocina}h)   <b>Varios:</b> ${fmtEUR.format(s.costesVarios)}`,
    `<b>Beneficio operacional:</b> ${fmtEUR.format(s.beneficio)}`,
  ];

  if (event.observaciones) {
    foot.push(``, `<b>Observaciones:</b> ${esc(event.observaciones)}`);
  }

  return [...head, ...items, ...foot].join('\n');
}

export interface TelegramButton {
  text: string;
  url: string;
}

/**
 * Mensaje breve que envía el supervisor: identifica el evento y lista la
 * consumición. Los datos económicos (comensales, PVP, costes) los completa
 * el manager desde el botón del mensaje.
 */
export function buildSupervisorMessage(
  grupo: string,
  fecha: string,
  lines: OrderLine[],
  drinks: Drink[],
  tipoServicio = 'Barra libre',
): string {
  const map = new Map(drinks.map((d) => [d.id, d]));
  const used = lines.filter((l) => l.qty > 0 && map.has(l.drinkId));
  const total = used.reduce((acc, l) => acc + l.qty * map.get(l.drinkId)!.unitCost, 0);

  const fechaES = new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const head = [
    `<b>CONSUMICIÓN DE EVENTO — ${esc(tipoServicio.toUpperCase())}</b>`,
    ``,
    `<b>Fecha:</b> ${esc(fechaES)}`,
    `<b>Grupo / evento:</b> ${esc(grupo || '—')}`,
    ``,
    `<b>Consumo (${used.length} artículos):</b>`,
  ];

  const items = used.map((l) => {
    const d = map.get(l.drinkId)!;
    const box = d.unit === 'caja' ? ' (caja)' : '';
    return `${l.qty}× ${esc(d.name)}${box} — ${fmtEUR.format(l.qty * d.unitCost)}`;
  });

  const foot = [
    ``,
    `<b>Total coste bebida (aprox.):</b> ${fmtEUR.format(total)}`,
    ``,
    `<i>Consumición enviada por el supervisor. Pulsa el botón para completar los datos y generar el Excel.</i>`,
  ];

  return [...head, ...items, ...foot].join('\n');
}

export async function sendTelegram(
  settings: TelegramSettings,
  message: string,
  button?: TelegramButton,
): Promise<void> {
  const token = settings.botToken.trim();
  const chatId = settings.chatId.trim();
  if (!token || !chatId) {
    throw new Error('Falta configurar el bot de Telegram (token y chat ID).');
  }
  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        ...(button
          ? { reply_markup: { inline_keyboard: [[button]] } }
          : {}),
      }),
    },
  );
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.description ? `: ${j.description}` : '';
    } catch {
      /* ignore */
    }
    throw new Error(`Telegram respondió con error ${res.status}${detail}`);
  }
}
