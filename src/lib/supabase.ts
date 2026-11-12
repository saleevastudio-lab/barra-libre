// Cliente y acceso a datos de Supabase (borrador compartido del flujo).
// Las credenciales se inyectan en build mediante variables de entorno
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (GitHub Secrets en CI).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { EventoDraft, Grupo } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;

const BUCKET = 'excels';

// ---------- Grupos ----------

export async function listGrupos(): Promise<Grupo[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('grupos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToGrupo);
}

export async function getGrupo(id: string): Promise<Grupo | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('grupos')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return rowToGrupo(data);
}

export async function createGrupo(
  g: Pick<Grupo, 'nombre' | 'os'>,
): Promise<Grupo> {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase
    .from('grupos')
    .insert({ nombre: g.nombre, os: g.os })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToGrupo(data);
}

export async function updateGrupo(
  id: string,
  patch: Partial<Omit<Grupo, 'id' | 'createdAt'>>,
): Promise<void> {
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase
    .from('grupos')
    .update({
      nombre: patch.nombre,
      os: patch.os,
      responsable: patch.responsable,
      fecha_analisis: patch.fechaAnalisis || null,
      observaciones: patch.observaciones,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- Eventos ----------

export async function listEventos(grupoId: string): Promise<EventoDraft[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('eventos')
    .select('*')
    .eq('grupo_id', grupoId)
    .order('orden', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToEvento);
}

export async function createEvento(
  grupoId: string,
  orden: number,
  init?: { nombre?: string; tipo?: string },
): Promise<EventoDraft> {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase
    .from('eventos')
    .insert({
      grupo_id: grupoId,
      orden,
      nombre: init?.nombre?.trim() || `Evento ${orden}`,
      tipo: init?.tipo ?? '',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToEvento(data);
}

/** Guarda las secciones editables de un evento (una llamada por sección). */
export async function updateEvento(
  id: string,
  patch: Partial<
    Pick<
      EventoDraft,
      | 'nombre'
      | 'tipo'
      | 'fecha'
      | 'duracion'
      | 'mesas'
      | 'ingresos'
      | 'comida'
      | 'bebida'
      | 'personal'
      | 'varios'
    >
  >,
): Promise<void> {
  if (!supabase) throw new Error('Supabase no configurado');
  const db: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.nombre !== undefined) db.nombre = patch.nombre;
  if (patch.tipo !== undefined) db.tipo = patch.tipo;
  if (patch.fecha !== undefined) db.fecha = patch.fecha || null;
  if (patch.duracion !== undefined) db.duracion = patch.duracion;
  if (patch.mesas !== undefined) db.mesas = patch.mesas;
  if (patch.ingresos !== undefined) db.ingresos = patch.ingresos;
  if (patch.comida !== undefined) db.comida = patch.comida;
  if (patch.bebida !== undefined) db.bebida = patch.bebida;
  if (patch.personal !== undefined) db.personal = patch.personal;
  if (patch.varios !== undefined) db.varios = patch.varios;
  const { error } = await supabase.from('eventos').update(db).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Suscripción en tiempo real a los cambios del grupo (grupo + eventos). */
export function subscribeGrupo(
  grupoId: string,
  onChange: () => void,
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`grupo-${grupoId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'eventos', filter: `grupo_id=eq.${grupoId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'grupos', filter: `id=eq.${grupoId}` },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Suscripción a la lista de grupos (nuevos grupos aparecen solos). */
export function subscribeGrupos(onChange: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('grupos-lista')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'grupos' },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------- Storage: Excel del grupo ----------

function slug(nombre: string): string {
  return (
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase() || 'GRUPO'
  );
}

/** Sube el Excel del grupo y devuelve su URL pública (sobrescribe el anterior). */
export async function uploadExcel(
  grupoNombre: string,
  blob: Blob,
): Promise<string> {
  if (!supabase) throw new Error('Supabase no configurado');
  const path = `${slug(grupoNombre)}.xlsx`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---------- PIN manager ----------

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getPinHash(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'pin_hash')
    .maybeSingle();
  return (data?.value as string | undefined) ?? null;
}

export async function setPin(pin: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no configurado');
  const hash = await sha256(pin);
  const { error } = await supabase
    .from('config')
    .upsert({ key: 'pin_hash', value: hash });
  if (error) throw new Error(error.message);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await getPinHash();
  if (!stored) return false;
  return (await sha256(pin)) === stored;
}

// ---------- Mapeo filas → modelos ----------

function rowToGrupo(r: Record<string, unknown>): Grupo {
  return {
    id: r.id as string,
    nombre: (r.nombre as string) ?? '',
    os: (r.os as string) ?? '',
    responsable: (r.responsable as string) ?? '',
    fechaAnalisis: (r.fecha_analisis as string | null) ?? '',
    observaciones: (r.observaciones as string) ?? '',
    createdAt: (r.created_at as string | undefined) ?? undefined,
  };
}

function rowToEvento(r: Record<string, unknown>): EventoDraft {
  return {
    id: r.id as string,
    grupoId: r.grupo_id as string,
    orden: (r.orden as number) ?? 1,
    nombre: (r.nombre as string) ?? '',
    tipo: (r.tipo as string) ?? '',
    fecha: (r.fecha as string | null) ?? '',
    duracion: (r.duracion as number) ?? 0,
    mesas: (r.mesas as number) ?? 0,
    ingresos: (r.ingresos as EventoDraft['ingresos']) ?? [],
    comida: (r.comida as EventoDraft['comida']) ?? [],
    bebida: (r.bebida as EventoDraft['bebida']) ?? [],
    personal: (r.personal as EventoDraft['personal']) ?? {
      extraSala: 0,
      internoSala: 0,
      extraCocina: 0,
      internoCocina: 0,
    },
    varios: (r.varios as EventoDraft['varios']) ?? [],
    updatedAt: (r.updated_at as string | undefined) ?? undefined,
  };
}
