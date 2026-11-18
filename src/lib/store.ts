// Persistencia local solo de ajustes del dispositivo (Telegram y sesión de
// manager); los datos de eventos viven en Supabase.
import type { TelegramSettings } from './types';

const SETTINGS_KEY = 'consumiciones.settings.v1';
const SESSION_KEY = 'consumiciones.manager.v1';

/**
 * Bot de Telegram ya integrado: el envío de constancias funciona sin
 * configuración manual. El manager puede sobrescribir estos valores en
 * Ajustes (por ejemplo para usar otro bot o chat).
 */
export const DEFAULT_TELEGRAM: Pick<TelegramSettings, 'botToken' | 'chatId'> = {
  botToken: '9037948597:AAFVAKyzYw8Z3QwFHJGsEV1XLOyj6pW1qHI',
  chatId: '-1004294178574',
};

export function loadSettings(): TelegramSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TelegramSettings>;
      return {
        botToken: p.botToken || DEFAULT_TELEGRAM.botToken,
        chatId: p.chatId || DEFAULT_TELEGRAM.chatId,
        managerUrl: p.managerUrl ?? '',
      };
    }
  } catch {
    /* valor por defecto */
  }
  return { ...DEFAULT_TELEGRAM, managerUrl: '' };
}

export function saveSettings(s: TelegramSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/** Sesión de manager en la pestaña (se pierde al cerrar el navegador). */
export function isManagerSession(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function setManagerSession(on: boolean): void {
  if (on) sessionStorage.setItem(SESSION_KEY, '1');
  else sessionStorage.removeItem(SESSION_KEY);
}