export interface Drink {
  id: string;
  name: string;
  category: CategoryId;
  unitCost: number;
  /** Unidad de medida: por unidad o por caja */
  unit: 'ud' | 'caja';
  /** true si lo creó el usuario (no viene del catálogo base) */
  custom?: boolean;
}

export interface OrderLine {
  drinkId: string;
  qty: number;
}

export type CategoryId =
  | 'vinos'
  | 'cerveza'
  | 'destilados'
  | 'licores'
  | 'refrescos'
  | 'otros';

export interface EventData {
  fecha: string; // yyyy-mm-dd
  os: string; // Nº OS
  grupo: string; // grupo / nombre del evento (ej. BCG)
  comensales: number; // adultos barra libre
  pvp: number; // PVP adulto (IVA incl.)
  ninos: number; // niños barra libre
  pvpNinos: number; // PVP niño (IVA incl.)
  // Coste social: horas extra / personal interno × sala / cocina
  horasExtraSala: number;
  horasPersonalSala: number;
  horasExtraCocina: number;
  horasPersonalCocina: number;
  rateExtra: number; // €/h horas extra (25 × 1,32 = 33)
  rateInterno: number; // €/h personal interno (16 × 1,32 = 21,12)
  // Costes varios (unidades × coste unitario)
  lavanderiaUnd: number;
  lavanderiaCoste: number;
  decoracionMesas: number;
  decoracionCoste: number;
  climatizacionHoras: number;
  climatizacionCoste: number;
  iluminacionHoras: number;
  iluminacionCoste: number;
  imprentaPersonas: number;
  imprentaCoste: number;
  dotacionUnd: number;
  dotacionCoste: number;
  auxiliaresUnd: number;
  auxiliaresCoste: number;
  observaciones: string;
}

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  /** URL base de la vista del manager (vacío = misma app, autodetectado). */
  managerUrl: string;
}

export interface HistoryEntry {
  id: string;
  sentAt: string;
  event: EventData;
  lines: OrderLine[];
  totalCoste: number;
}
