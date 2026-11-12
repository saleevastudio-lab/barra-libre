// Envío de mensajes por Telegram: ahora solo como constancia de lo consumido.
// El bot y el chat se configuran en el dispositivo (SettingsDialog).
import type { EventoDraft, Grupo, TelegramSettings } from './types';

export async function sendTelegram(
  settings: TelegramSettings,
  text: string,
): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    },
  );
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
  } | null;
  if (!res.ok || !data?.ok) {
    throw new Error(data?.description ?? 'Telegram rechazó el mensaje');
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Constancia de escandallo (comida o bebida) para el grupo de Telegram. */
export function buildConstancia(
  grupo: Grupo,
  evento: EventoDraft,
  seccion: 'comida' | 'bebida',
  lineas: { nombre: string; cantidad: number; coste: number | null; total: number }[],
  total: number,
): string {
  const titulo = seccion === 'comida' ? 'COMIDA (cocina)' : 'BEBIDA (barra)';
  const rows = lineas
    .map(
      (l) =>
        `• ${esc(l.nombre)} × ${l.cantidad} — ${l.total.toFixed(2).replace('.', ',')} €`,
    )
    .join('\n');
  return [
    `<b>${titulo}</b>`,
    `Grupo: <b>${esc(grupo.nombre)}</b>${grupo.os ? ` · OS ${esc(grupo.os)}` : ''}`,
    `Evento: ${esc(evento.nombre || `Evento ${evento.orden}`)}${evento.fecha ? ` · ${evento.fecha}` : ''}`,
    '',
    rows || '(sin líneas)',
    '',
    `<b>Total: ${total.toFixed(2).replace('.', ',')} €</b>`,
  ].join('\n');
}
