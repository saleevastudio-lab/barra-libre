// Modelo de datos del flujo por grupos (borrador compartido en Supabase).

export type CategoriaIngreso = 'Comida' | 'Bebida' | 'Otros';

/** Línea de ingreso del evento (hasta 6 por evento en la plantilla). */
export interface IncomeLine {
  concepto: string;
  categoria: CategoriaIngreso | '';
  paxAdultos: number;
  pvpAdulto: number;
  paxNinos: number;
  pvpNino: number;
  /** null → IVA por defecto de Parámetros (10%). */
  iva: number | null;
}

/** Línea de escandallo (comida o bebida). coste null → se toma del catálogo. */
export interface CostLine {
  nombre: string;
  cantidad: number;
  /** Coste siempre por UNIDAD (como en el catálogo). */
  coste: number | null;
  /** true = la cantidad se cuenta por cajas de 24 (solo refrescos/zumos);
   *  el importe total y el Excel multiplican la cantidad por 24. */
  esCaja?: boolean;
}

export interface PersonalDraft {
  extraSala: number;
  internoSala: number;
  extraCocina: number;
  internoCocina: number;
}

/** Varios: los 9 conceptos fijos de la plantilla, en este orden. */
export interface VariosLine {
  cantidad: number;
  costeUnitario: number;
}

/** Borrador de un evento (una pestaña del Excel del grupo). */
export interface EventoDraft {
  id: string;
  grupoId: string;
  orden: number;
  nombre: string;
  /** Nombre corto del tipo de servicio (el Excel lo traduce al oficial). */
  tipo: string;
  fecha: string; // YYYY-MM-DD o ''
  duracion: number;
  mesas: number;
  ingresos: IncomeLine[];
  comida: CostLine[];
  bebida: CostLine[];
  personal: PersonalDraft;
  varios: VariosLine[];
  updatedAt?: string;
}

/** Grupo = cliente = un archivo Excel. */
export interface Grupo {
  id: string;
  nombre: string;
  os: string;
  responsable: string;
  fechaAnalisis: string; // YYYY-MM-DD o ''
  observaciones: string;
  createdAt?: string;
}

/** Ajustes del bot de Telegram (se guardan en el dispositivo). */
export interface TelegramSettings {
  botToken: string;
  chatId: string;
  managerUrl: string;
}
