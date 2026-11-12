// Persistencia local solo de ajustes del dispositivo (Telegram y sesión de
// manager); los datos de eventos viven en Supabase.
import type { TelegramSettings } from './types';

const SETTINGS_KEY = 'consumiciones.settings.v1';
const SESSION_KEY = 'consumiciones.manager.v1';

export function loadSettings(): TelegramSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TelegramSettings>;
      return {
        botToken: p.botToken ?? '',
        chatId: p.chatId ?? '',
        managerUrl: p.managerUrl ?? '',
      };
    }
  } catch {
    /* valor por defecto */
  }
  return { botToken: '', chatId: '', managerUrl: '' };
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
