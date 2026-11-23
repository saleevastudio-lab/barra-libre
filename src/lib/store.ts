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

/** True si la sesión actual es de manager. */
export function isManagerSession(): boolean {
  return getSession()?.role === 'manager';
}
// ---------- Sesión con código (login) ----------
// Los supervisores entran con su nombre + código 0000; el manager solo con
// el código 4444. La sesión vive en la pestaña (sessionStorage).

export const SUPERVISOR_CODE = '0000';
export const MANAGER_CODE = '4444';

export interface SessionUser {
  role: 'manager' | 'supervisor';
  name: string;
}

export function getSession(): SessionUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SessionUser>;
    if (p.role !== 'manager' && p.role !== 'supervisor') return null;
    return {
      role: p.role,
      name: typeof p.name === 'string' ? p.name : '',
    };
  } catch {
    return null;
  }
}

export function startSession(user: SessionUser): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

/** Nombre del usuario actual para firmar registros y constancias. */
export function currentUserName(): string {
  const u = getSession();
  if (!u) return '';
  return u.role === 'manager' ? (u.name || 'Manager') : u.name;
}