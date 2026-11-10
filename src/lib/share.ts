import { DRINKS } from './catalog';
import type { Drink, OrderLine } from './types';

/**
 * Codificación compacta de la consumición para viajar dentro de la URL
 * del botón de Telegram (fragmento #, no sale del navegador).
 *
 * Formato JSON: { v:1, g:grupo, f:fecha, l:[[indiceBebida, qty, coste],...] }
 * → base64url. Se usan índices del catálogo para mantener la URL corta.
 */
export interface SharedConsumption {
  grupo: string;
  fecha: string;
  lines: OrderLine[];
  drinks: Drink[];
}

export function encodeConsumption(s: SharedConsumption): string {
  // v2: cada línea lleva nombre, cantidad, coste y unidad de medida, para que
  // los ítems personalizados y las unidades (ud/caja) sobrevivan al envío.
  const map = new Map(s.drinks.map((d) => [d.id, d]));
  const l = s.lines
    .filter((ln) => ln.qty > 0 && map.has(ln.drinkId))
    .map((ln) => {
      const d = map.get(ln.drinkId)!;
      return [d.name, ln.qty, d.unitCost, d.unit === 'caja' ? 1 : 0];
    });
  const json = JSON.stringify({ v: 2, g: s.grupo, f: s.fecha, l });
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeConsumption(
  payload: string,
): { grupo: string; fecha: string; lines: OrderLine[]; drinks: Drink[] } | null {
  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    const o = JSON.parse(json) as {
      v: number;
      g?: string;
      f?: string;
      l?: unknown[];
    };
    if (!Array.isArray(o.l)) return null;

    // v2: [[nombre, qty, coste, esCaja], ...] — ítems exactos del supervisor
    if (o.v === 2) {
      const drinks: Drink[] = [];
      const lines: OrderLine[] = [];
      (o.l as [string, number, number, number][]).forEach(
        ([n, q, c, box], i) => {
          if (!(q > 0) || typeof n !== 'string' || !n.trim()) return;
          drinks.push({
            id: `s${i}`,
            name: n,
            category: matchCategory(n),
            unitCost: typeof c === 'number' && c >= 0 ? c : 0,
            unit: box ? 'caja' : 'ud',
          });
          lines.push({ drinkId: `s${i}`, qty: Math.round(q) });
        },
      );
      if (lines.length === 0) return null;
      return {
        grupo: typeof o.g === 'string' ? o.g : '',
        fecha: typeof o.f === 'string' ? o.f : '',
        lines,
        drinks,
      };
    }

    // v1 (enlaces antiguos): [[índiceCatálogo, qty, coste], ...]
    if (o.v === 1) {
      const lines: OrderLine[] = [];
      const drinks: Drink[] = DRINKS.map((d) => ({ ...d }));
      for (const [i, q, c] of o.l as [number, number, number][]) {
        const d = drinks[i];
        if (!d || !(q > 0)) continue;
        d.unitCost = typeof c === 'number' && c >= 0 ? c : d.unitCost;
        lines.push({ drinkId: d.id, qty: Math.round(q) });
      }
      if (lines.length === 0) return null;
      return {
        grupo: typeof o.g === 'string' ? o.g : '',
        fecha: typeof o.f === 'string' ? o.f : '',
        lines,
        drinks,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Encaja un nombre de artículo en la categoría del catálogo oficial. */
function matchCategory(name: string): Drink['category'] {
  const n = name.toLowerCase();
  for (const d of DRINKS) {
    if (d.name.toLowerCase() === n) return d.category;
  }
  if (/cerveza|barril/.test(n)) return 'cerveza';
  if (/vino|tinto|blanco|flor|melior|flo\b|cava/.test(n)) return 'vinos';
  if (/sambuca|patxaran|baileys|jagerma|limonc|licor/.test(n)) return 'licores';
  if (/absolut|bombay|label|bacar|bacard|teresa|tequila|patron|vodka|ginebra|ron|whisk/.test(n))
    return 'destilados';
  if (/refresco|agua|aquarius|zumo|nesta|cola|fanta|sprite|tonica|soda/.test(n))
    return 'refrescos';
  return 'otros';
}

/**
 * Construye la URL del manager con la consumición incrustada.
 * Compatible con HashRouter: `#/manager?d=<payload>`.
 */
export function managerUrlWithData(base: string, payload: string): string {
  const clean = base.split('#')[0];
  return `${clean}#/manager?d=${payload}`;
}

/** URL base de esta misma app (para el botón de Telegram). */
export function appBaseUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}
