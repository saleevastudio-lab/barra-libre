import type { CategoryId, Drink } from './types';

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'vinos', label: 'Vinos' },
  { id: 'cerveza', label: 'Cerveza' },
  { id: 'destilados', label: 'Destilados' },
  { id: 'licores', label: 'Licores' },
  { id: 'refrescos', label: 'Refrescos y zumos' },
  { id: 'otros', label: 'Otros' },
];

// Catálogo extraído de la hoja "Datos Bebida" del libro original.
// Costes por unidad tomados del ejemplo real de consumo (hoja "Bebida").
// Catálogo oficial: nombres y costes exactos de la hoja "Datos Bebida"
// de los P&L reales (los managers escriben estos mismos artículos y costes).
const RAW: [string, CategoryId, number][] = [
  ['Sambuca', 'licores', 9.78],
  ['Patxaran Baines', 'licores', 13.45],
  ['Baileys', 'licores', 9.44],
  ['Jagermaister', 'licores', 9.74],
  ['Limonccello Vila Massa', 'licores', 9.66],
  ['Absolut', 'destilados', 11.05],
  ['Bombay Saphire', 'destilados', 13.41],
  ['White Label', 'destilados', 11.13],
  ['Bacardi ', 'destilados', 12.65],
  ['Santa Teresa Reserva', 'destilados', 10.85],
  ['Tequila Patron Silver', 'destilados', 35.38],
  ['Refresco Coca Cola ', 'refrescos', 0.6],
  ['Refresco Coca Cola Zero', 'refrescos', 0.61],
  ['Refresco Fanta Limon', 'refrescos', 0.53],
  ['Refresco Fanta Naranja ', 'refrescos', 0.53],
  ['Refresco Sprite', 'refrescos', 0.55],
  ['Refresco Tonica Fever Tree Indian', 'refrescos', 0.75],
  ['Refresco Soda Fever Tree ', 'refrescos', 0.81],
  ['Aquarius Naranja', 'refrescos', 0.705],
  ['AquariusLimon', 'refrescos', 0.705],
  ['Nesta', 'refrescos', 0.8],
  ['Zumo Maid ', 'refrescos', 0.58],
  ['Cafe capsulas', 'otros', 0.4],
  ['Infusion', 'otros', 0.32],
  ['Leche semi 1,5', 'otros', 1.45],
  ['Barril', 'cerveza', 49.87],
  ['cerveza 0,0 ', 'cerveza', 0.84375],
  ['Flo Blanco ', 'vinos', 3],
  ['melior tinto', 'vinos', 4.95],
  ['roger de flor', 'vinos', 2.14],
];

export const DRINKS: Drink[] = RAW.map(([name, category, unitCost], i) => {
  // Los refrescos y zumos se contabilizan por caja (24 uds) desde el inicio:
  // así el supervisor no tiene que cambiar la unidad en cada evento.
  const caja = category === 'refrescos';
  return {
    id: `d${i}`,
    name,
    category,
    unitCost: caja ? Math.round(unitCost * 24 * 100) / 100 : unitCost,
    unit: caja ? ('caja' as const) : ('ud' as const),
  };
});

// Tipos de servicio seleccionables en la app (supervisor y manager).
export const SERVICE_TYPES = [
  'Barra libre',
  'Cóctel',
  'Coffee Break / Similar',
  'Otros',
] as const;

export const DEFAULT_EVENT = {
  fecha: new Date().toISOString().slice(0, 10),
  os: '',
  grupo: '',
  tipoServicio: 'Barra libre' as string,
  comensales: 0,
  pvp: 0,
  ninos: 0,
  pvpNinos: 0,
  horasExtraSala: 0,
  horasPersonalSala: 52,
  horasExtraCocina: 0,
  horasPersonalCocina: 32,
  rateExtra: 33,
  rateInterno: 21.12,
  lavanderiaUnd: 8,
  lavanderiaCoste: 1.5,
  decoracionMesas: 0,
  decoracionCoste: 0,
  climatizacionHoras: 0,
  climatizacionCoste: 0,
  iluminacionHoras: 0,
  iluminacionCoste: 0,
  imprentaPersonas: 0,
  imprentaCoste: 0,
  dotacionUnd: 0,
  dotacionCoste: 0,
  auxiliaresUnd: 0,
  auxiliaresCoste: 0,
  observaciones: '',
};
