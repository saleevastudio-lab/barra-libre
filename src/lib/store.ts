import type { Drink, EventData, HistoryEntry, OrderLine, TelegramSettings } from './types';
import { DEFAULT_EVENT, DRINKS, normalizeTipo } from './catalog';

const K_EVENT = 'bl.event';
const K_LINES = 'bl.lines';
const K_SETTINGS = 'bl.settings';
const K_HISTORY = 'bl.history';
const K_DRINKS = 'bl.drinks';

const CATEGORIES: Drink['category'][] = [
  'vinos',
  'cerveza',
  'destilados',
  'licores',
  'refrescos',
  'otros',
];

/**
 * Catálogo del dispositivo: parte del catálogo base + los ítems creados por
 * el usuario y sus ediciones (nombre, coste, unidad de medida). Los ítems del
 * catálogo base que desaparezcan del guardado se recuperan, para que las
 * actualizaciones de la app no borren productos.
 */
export function loadDrinks(): Drink[] {
  try {
    const raw = localStorage.getItem(K_DRINKS);
    if (raw) {
      const parsed = JSON.parse(raw) as Drink[];
      if (Array.isArray(parsed)) {
        // Migración 1: la caja (24 uds) solo aplica a refrescos y zumos; los
        // ítems guardados como caja en otra categoría vuelven a unidad,
        // coste ÷24 para conservar el coste real por unidad.
        // Migración 2: los refrescos/zumos guardados por unidad pasan a caja
        // (coste ×24), que es la unidad de trabajo habitual del supervisor.
        const migrated = parsed.map((d) => {
          if (!d) return d;
          if (d.unit === 'caja' && d.category !== 'refrescos') {
            return { ...d, unit: 'ud' as const, unitCost: Math.round((d.unitCost / 24) * 100) / 100 };
          }
          if (d.category === 'refrescos' && d.unit === 'ud') {
            return { ...d, unit: 'caja' as const, unitCost: Math.round(d.unitCost * 24 * 100) / 100 };
          }
          return d;
        });
        const valid = migrated.filter(
          (d) =>
            d &&
            typeof d.id === 'string' &&
            typeof d.name === 'string' &&
            CATEGORIES.includes(d.category) &&
            typeof d.unitCost === 'number' &&
            (d.unit === 'ud' || d.unit === 'caja'),
        );
        const ids = new Set(valid.map((d) => d.id));
        // Los ítems del catálogo base que falten se añaden con su unidad
        // por defecto (los refrescos llegan como caja, ver catalog.ts).
        const missing = DRINKS.filter((d) => !ids.has(d.id)).map((d) => ({ ...d }));
        return [...valid, ...missing];
      }
    }
  } catch {
    /* ignore */
  }
  return DRINKS.map((d) => ({ ...d }));
}

export function saveDrinks(drinks: Drink[]) {
  try {
    localStorage.setItem(K_DRINKS, JSON.stringify(drinks));
  } catch {
    /* ignore */
  }
}

export function loadLines(): OrderLine[] {
  try {
    const raw = localStorage.getItem(K_LINES);
    if (raw) return JSON.parse(raw) as OrderLine[];
  } catch {
    /* ignore */
  }
  return [];
}

export function saveLines(lines: OrderLine[]) {
  try {
    localStorage.setItem(K_LINES, JSON.stringify(lines));
  } catch {
    /* ignore */
  }
}

export function loadEvent(): EventData {
  try {
    const raw = localStorage.getItem(K_EVENT);
    if (raw) {
      const parsed = JSON.parse(raw) as EventData & { modalidad?: string };
      // Migración: el antiguo campo "modalidad" pasa a ser "grupo"
      if (parsed.grupo === undefined && parsed.modalidad !== undefined) {
        parsed.grupo = parsed.modalidad;
      }
      // Migración: el tipo de servicio se normaliza a los 7 oficiales con clave
      parsed.tipoServicio = normalizeTipo(parsed.tipoServicio);
      return { ...DEFAULT_EVENT, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_EVENT };
}

export function saveEvent(e: EventData) {
  try {
    localStorage.setItem(K_EVENT, JSON.stringify(e));
  } catch {
    /* ignore */
  }
}

// Credenciales precargadas: el supervisor envía sin configurar nada.
// En el despliegue de GitHub Pages se inyectan en el build desde secretos del
// repositorio (VITE_TELEGRAM_BOT_TOKEN / VITE_TELEGRAM_CHAT_ID); en local se
// leen del .env (que no se sube). En cualquier caso pueden sobrescribirse
// desde el diálogo de ajustes (se guardan en localStorage de ese dispositivo).
export const DEFAULT_SETTINGS: TelegramSettings = {
  botToken: import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '',
  chatId: import.meta.env.VITE_TELEGRAM_CHAT_ID || '',
  managerUrl: '',
};

export function loadSettings(): TelegramSettings {
  try {
    const raw = localStorage.getItem(K_SETTINGS);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: TelegramSettings) {
  try {
    localStorage.setItem(K_SETTINGS, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(K_HISTORY);
    if (raw) return JSON.parse(raw) as HistoryEntry[];
  } catch {
    /* ignore */
  }
  return [];
}

export function pushHistory(entry: HistoryEntry) {
  const list = [entry, ...loadHistory()].slice(0, 50);
  try {
    localStorage.setItem(K_HISTORY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

export function clearHistory(): HistoryEntry[] {
  try {
    localStorage.removeItem(K_HISTORY);
  } catch {
    /* ignore */
  }
  return [];
}
