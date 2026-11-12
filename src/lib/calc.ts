// Cálculo en cliente del resultado de un evento (vista previa del semáforo).
// Replica la lógica de la hoja Evento de la plantilla; el Excel es la fuente
// final (recalcula al abrirse).
import type { EventoDraft } from './types';
import { RATE_EXTRA, RATE_INTERNO, TIPOS_SERVICIO, VARIOS_CONCEPTOS } from './catalog';

export interface EventoPreview {
  bruta: number;
  iva: number;
  neta: number;
  netaComida: number;
  netaBebida: number;
  costeComida: number;
  costeBebida: number;
  costePersonal: number;
  costeVarios: number;
  costeTotal: number;
  beneficio: number;
  margen: number;
  objetivo: number;
  estado: '' | 'sin-ingresos' | 'falta-tipo' | 'en-objetivo' | 'ajustado' | 'bajo';
}

const IVA_DEFECTO = 0.1;
const TOL_AMBAR = 0.05;

export function previewEvento(e: EventoDraft): EventoPreview {
  let bruta = 0;
  let neta = 0;
  let netaComida = 0;
  let netaBebida = 0;
  for (const l of e.ingresos) {
    const total = l.paxAdultos * l.pvpAdulto + l.paxNinos * l.pvpNino;
    if (total === 0) continue;
    const iva = l.iva ?? IVA_DEFECTO;
    const lineaNeta = total / (1 + iva);
    bruta += total;
    neta += lineaNeta;
    if (l.categoria === 'Comida') netaComida += lineaNeta;
    else if (l.categoria === 'Bebida') netaBebida += lineaNeta;
  }

  const costeComida = e.comida.reduce(
    (a, l) => a + l.cantidad * (l.coste ?? 0),
    0,
  );
  const costeBebida = e.bebida.reduce(
    (a, l) => a + l.cantidad * (l.coste ?? 0),
    0,
  );
  const p = e.personal;
  const costePersonal =
    (p.extraSala + p.extraCocina) * RATE_EXTRA +
    (p.internoSala + p.internoCocina) * RATE_INTERNO;
  const costeVarios = e.varios.reduce(
    (a, l) => a + (l.cantidad || 0) * (l.costeUnitario || 0),
    0,
  );
  const costeTotal = costeComida + costeBebida + costePersonal + costeVarios;
  const beneficio = neta - costeTotal;
  const margen = neta > 0 ? beneficio / neta : 0;
  const objetivo =
    TIPOS_SERVICIO.find((t) => t.short === e.tipo)?.objetivo ?? 0;

  let estado: EventoPreview['estado'] = '';
  if (e.ingresos.some((l) => l.paxAdultos * l.pvpAdulto + l.paxNinos * l.pvpNino > 0)) {
    if (!e.tipo) estado = 'falta-tipo';
    else if (neta === 0) estado = 'sin-ingresos';
    else if (margen >= objetivo) estado = 'en-objetivo';
    else if (margen >= objetivo - TOL_AMBAR) estado = 'ajustado';
    else estado = 'bajo';
  }

  return {
    bruta,
    iva: bruta - neta,
    neta,
    netaComida,
    netaBebida,
    costeComida,
    costeBebida,
    costePersonal,
    costeVarios,
    costeTotal,
    beneficio,
    margen,
    objetivo,
    estado,
  };
}

export function previewGrupo(eventos: EventoDraft[]) {
  const ps = eventos.map(previewEvento);
  const sum = (k: keyof EventoPreview) => ps.reduce((a, p) => a + (p[k] as number), 0);
  const neta = sum('neta');
  const costeComida = sum('costeComida');
  const costeBebida = sum('costeBebida');
  const costePersonal = sum('costePersonal');
  const costeVarios = sum('costeVarios');
  const coste = costeComida + costeBebida + costePersonal + costeVarios;
  const beneficio = neta - coste;
  return {
    neta,
    coste,
    beneficio,
    margen: neta > 0 ? beneficio / neta : 0,
    costeComida,
    costeBebida,
    costePersonal,
    costeVarios,
  };
}

export type GrupoPreview = ReturnType<typeof previewGrupo>;

/** Datos para la doughnut «Dónde va cada euro de venta neta» (mismos
 *  colores que la gráfica de la plantilla Excel). */
export interface EuroSlice {
  nombre: string;
  valor: number;
  color: string;
}

export function euroSlices(p: {
  neta: number;
  costeComida: number;
  costeBebida: number;
  costePersonal: number;
  costeVarios: number;
}): EuroSlice[] {
  if (p.neta <= 0) return [];
  const beneficio =
    p.neta - p.costeComida - p.costeBebida - p.costePersonal - p.costeVarios;
  return [
    { nombre: 'Coste comida', valor: p.costeComida, color: '#E0A800' },
    { nombre: 'Coste bebida', valor: p.costeBebida, color: '#7C7C7C' },
    { nombre: 'Personal', valor: p.costePersonal, color: '#B9B2A0' },
    { nombre: 'Costes varios', valor: p.costeVarios, color: '#D8C9A3' },
    { nombre: 'Beneficio', valor: Math.max(0, beneficio), color: '#3F7D4E' },
  ].filter((s) => s.valor > 0.005);
}

export { VARIOS_CONCEPTOS };
