// Catálogos y tipos de servicio oficiales (coherentes con la hoja
// Parámetros / Catálogo de "Plantilla eventos.xlsx").

export interface CatalogDrink {
  id: string;
  name: string;
  /** Coste por unidad de uso (€), como en el catálogo del Excel. */
  unitCost: number;
  /** 'caja' = se cuenta por caja de 24 en la app; el Excel recibe unidades. */
  unit: 'ud' | 'caja';
}

// Catálogo de bebidas (hoja "Catálogo" de la plantilla). Los refrescos se
// trabajan por caja (×24) en la app para ir más rápido; al escribir el
// Excel se convierte a unidades.
const RAW: [string, number, 'ud' | 'caja'][] = [
  ['Sambuca', 9.78, 'ud'],
  ['Patxaran Baines', 13.45, 'ud'],
  ['Baileys', 9.44, 'ud'],
  ['Jagermaister', 9.74, 'ud'],
  ['Limonccello Vila Massa', 9.66, 'ud'],
  ['Absolut', 11.05, 'ud'],
  ['Bombay Saphire', 13.41, 'ud'],
  ['White Label', 11.13, 'ud'],
  ['Bacardi', 12.65, 'ud'],
  ['Santa Teresa Reserva', 10.85, 'ud'],
  ['Tequila Patron Silver', 35.38, 'ud'],
  ['Refresco Coca Cola', 0.6, 'caja'],
  ['Refresco Coca Cola Zero', 0.61, 'caja'],
  ['Refresco Fanta Limon', 0.53, 'caja'],
  ['Refresco Fanta Naranja', 0.53, 'caja'],
  ['Refresco Sprite', 0.55, 'caja'],
  ['Refresco Tonica Fever Tree Indian', 0.75, 'caja'],
  ['Refresco Soda Fever Tree', 0.81, 'caja'],
  ['Aquarius Naranja', 0.705, 'caja'],
  ['Aquarius Limon', 0.705, 'caja'],
  ['Nesta', 0.8, 'caja'],
  ['Zumo Maid', 0.58, 'caja'],
  ['Barril', 49.87, 'ud'],
  ['Cerveza 0,0', 0.84375, 'caja'],
  ['Flo Blanco', 3, 'ud'],
  ['Melior tinto', 4.95, 'ud'],
  ['Roger de Flor', 2.14, 'ud'],
  ['Cafe capsulas', 0.4, 'ud'],
  ['Infusion', 0.32, 'ud'],
  ['Leche semi 1,5', 1.45, 'ud'],
];

export const DRINKS: CatalogDrink[] = RAW.map(([name, unitCost, unit], i) => ({
  id: `d${i}`,
  name,
  unitCost,
  unit,
}));

/** Platos sugeridos del catálogo de comida (sin coste: se rellena a mano). */
export const PLATOS: string[] = [
  'Crujiente de parmesano con carpaccio de ternera y trufa',
  'Gazpacho de remolacha con anchoa y brocheta de pimiento asado',
  'Terrina de ensaladilla rusa con ventresca de atun',
  'Croquetas de marisco con alioli de erizo de mar',
  'Gamba en tempura con mayonesa agridulce',
  'Ensalada de gambas con huevas de arenque y microbrotes',
  'Lomo de Merluza asado con azafran esparragos al diente y salsa',
  'Solomillo de ternera con verduras y salsa aromatica',
  'Coulant de chocolate negro con vainilla y fruta de la pasion',
];

// Tipos de servicio (hoja Parámetros, B7:F12). El Excel valida contra la
// etiqueta larga; la app trabaja con el nombre corto.
export interface TipoServicio {
  /** Etiqueta oficial de la plantilla (celda C6 de cada Evento). */
  full: string;
  /** Nombre corto (columna F de Parámetros / Resumen). */
  short: string;
  /** Objetivo de margen operacional (Parámetros!E7:E12). */
  objetivo: number;
}

export const TIPOS_SERVICIO: TipoServicio[] = [
  { full: 'Coffee breaks & servicios similares', short: 'Coffee break', objetivo: 0.6 },
  { full: 'Cócteles & servicios similares', short: 'Cóctel', objetivo: 0.45 },
  { full: 'Almuerzos & cenas de empresa (buffet / menú servido)', short: 'Almuerzo / cena empresa', objetivo: 0.3 },
  { full: 'Banquetes / galas & servicios similares', short: 'Banquete / gala', objetivo: 0.45 },
  { full: 'Banquetes de boda (Romance)', short: 'Boda', objetivo: 0.3 },
  { full: 'Barras libres', short: 'Barra libre', objetivo: 0.7 },
];

export const CONCEPTOS_INGRESO = [
  'Menú / banquete',
  'Aperitivo',
  'Cóctel',
  'Coffee break',
  'Almuerzo de trabajo',
  'Cena de gala',
  'Barra libre / open bar',
  'Alquiler de sala',
  'Otros',
];

/** Los 9 conceptos fijos de costes varios (hoja Evento, filas 90-98). */
export const VARIOS_CONCEPTOS = [
  'Lavandería',
  'Decoración de mesa',
  'Climatización',
  'Iluminación',
  'Imprenta',
  'Dotación (roturas)',
  'Artículos auxiliares',
  'Audiovisuales',
  'Rental',
];

/** Tarifas de personal (Parámetros!E17:E20): 25×1,32 y 16×1,32. */
export const RATE_EXTRA = 33;
export const RATE_INTERNO = 21.12;

export const MAX_EVENTOS_POR_GRUPO = 8;
export const MAX_INGRESOS = 6;
export const MAX_LINEAS_ESCANDALLO = 25;
