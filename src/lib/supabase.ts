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

// ---------- Respaldo de fechas DESDE/HASTA en `config` ----------
// La tabla `grupos` puede no tener aún las columnas fecha_desde/fecha_hasta.
// Mientras tanto, las fechas se guardan en la tabla config (clave/valor) bajo
// `grupo_fechas:<id>`, y al leer se fusionan con la fila del grupo. Si las
// columnas existen, estas tienen prioridad y el respaldo se ignora.

const FECHAS_KEY = (id: string) => `grupo_fechas:${id}`;
/** Nombre del archivo Excel vigente de cada grupo (para borrar el anterior). */
const EXCEL_KEY = (id: string) => `grupo_excel:${id}`;

async function trackedExcelName(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('config')
    .select('value')
    .eq('key', EXCEL_KEY(id))
    .maybeSingle();
  return (data?.value as string | undefined) ?? null;
}

async function trackExcelName(id: string, name: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('config').upsert({ key: EXCEL_KEY(id), value: name });
}

// Llamadas REST directas para la limpieza. Se usan en lugar de supabase-js
// porque, tras un borrado, la cola del cliente podía quedarse bloqueada y la
// limpieza nunca llegaba a ejecutarse. Así cada borrado es una petición fetch
// independiente y siempre se dispara.
function restHeaders(): Record<string, string> {
  return { apikey: anonKey as string, Authorization: `Bearer ${anonKey as string}` };
}

async function restDeleteConfig(key: string): Promise<void> {
  const res = await fetch(`${url}/rest/v1/config?key=eq.${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: restHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error(`config ${key}: HTTP ${res.status}`);
}

async function storageRemoveFile(file: string): Promise<void> {
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURIComponent(file)}`, {
    method: 'DELETE',
    headers: restHeaders(),
  });
  // Storage responde 400 con "resource not found" si el archivo ya no existe.
  if (!res.ok && res.status !== 404 && res.status !== 400) {
    throw new Error(`storage ${file}: HTTP ${res.status}`);
  }
}

async function saveFechasFallback(
  id: string,
  desde: string,
  hasta: string,
): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('config')
    .upsert({ key: FECHAS_KEY(id), value: JSON.stringify({ desde, hasta }) });
}

async function loadFechasFallbackMap(
  ids: string[],
): Promise<Record<string, { desde: string; hasta: string }>> {
  const map: Record<string, { desde: string; hasta: string }> = {};
  if (!supabase || ids.length === 0) return map;
  const { data } = await supabase
    .from('config')
    .select('key,value')
    .like('key', 'grupo_fechas:%');
  for (const row of data ?? []) {
    const id = ((row.key as string) ?? '').replace('grupo_fechas:', '');
    if (!ids.includes(id)) continue;
    try {
      const v = JSON.parse((row.value as string) ?? '{}') as {
        desde?: string;
        hasta?: string;
      };
      map[id] = { desde: v.desde ?? '', hasta: v.hasta ?? '' };
    } catch {
      /* valor inválido: se ignora */
    }
  }
  return map;
}

function withFechasFallback(
  g: Grupo,
  fb?: { desde: string; hasta: string },
): Grupo {
  if (!fb) return g;
  return {
    ...g,
    fechaDesde: g.fechaDesde || fb.desde,
    fechaHasta: g.fechaHasta || fb.hasta,
  };
}

// ---------- Grupos ----------

export async function listGrupos(): Promise<Grupo[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('grupos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const grupos = (data ?? []).map(rowToGrupo);
  const fb = await loadFechasFallbackMap(grupos.map((g) => g.id));
  return grupos.map((g) => withFechasFallback(g, fb[g.id]));
}

export async function getGrupo(id: string): Promise<Grupo | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('grupos')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  const g = rowToGrupo(data);
  const { data: cfg } = await supabase
    .from('config')
    .select('value')
    .eq('key', FECHAS_KEY(id))
    .maybeSingle();
  if (cfg?.value) {
    try {
      const v = JSON.parse(cfg.value as string) as {
        desde?: string;
        hasta?: string;
      };
      return withFechasFallback(g, { desde: v.desde ?? '', hasta: v.hasta ?? '' });
    } catch {
      /* valor inválido: se ignora */
    }
  }
  return g;
}

export async function createGrupo(
  g: Pick<Grupo, 'nombre' | 'os' | 'fechaDesde' | 'fechaHasta'>,
): Promise<Grupo> {
  if (!supabase) throw new Error('Supabase no configurado');
  const row = {
    nombre: g.nombre,
    os: g.os,
    fecha_desde: g.fechaDesde || null,
    fecha_hasta: g.fechaHasta || null,
  };
  let res = await supabase.from('grupos').insert(row).select().single();
  // Compatibilidad mientras la tabla no tenga las columnas de fechas:
  // si fecha_desde/fecha_hasta no existen aún, se reintenta sin ellas.
  if (res.error && /fecha_(desde|hasta)/.test(res.error.message)) {
    res = await supabase
      .from('grupos')
      .insert({ nombre: g.nombre, os: g.os })
      .select()
      .single();
    // Sin columnas de fechas: se guardan en el respaldo de config.
    if (!res.error && (g.fechaDesde || g.fechaHasta)) {
      await saveFechasFallback(
        res.data.id as string,
        g.fechaDesde || '',
        g.fechaHasta || '',
      );
    }
  }
  if (res.error) throw new Error(res.error.message);
  return rowToGrupo(res.data);
}

export async function updateGrupo(
  id: string,
  patch: Partial<Omit<Grupo, 'id' | 'createdAt'>>,
): Promise<void> {
  if (!supabase) throw new Error('Supabase no configurado');
  const row: Record<string, unknown> = {
    nombre: patch.nombre,
    os: patch.os,
    fecha_desde: patch.fechaDesde || null,
    fecha_hasta: patch.fechaHasta || null,
    fecha_analisis: patch.fechaAnalisis || null,
    observaciones: patch.observaciones,
  };
  let res = await supabase.from('grupos').update(row).eq('id', id);
  if (res.error && /fecha_(desde|hasta)/.test(res.error.message)) {
    // Sin columnas de fechas: se actualizan los demás campos y las fechas
    // van al respaldo de config (así "Guardar" persiste DESDE/HASTA).
    const { fecha_desde: _fd, fecha_hasta: _fh, ...rest } = row;
    res = await supabase.from('grupos').update(rest).eq('id', id);
    if (!res.error && (patch.fechaDesde || patch.fechaHasta)) {
      await saveFechasFallback(id, patch.fechaDesde ?? '', patch.fechaHasta ?? '');
    }
  } else if (!res.error) {
    // Columnas existentes: cualquier respaldo antiguo sobra.
    supabase.from('config').delete().eq('key', FECHAS_KEY(id)).then(() => {});
  }
  if (res.error) throw new Error(res.error.message);
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

/** Elimina un evento del grupo (manager). */
export async function deleteEvento(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.from('eventos').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Elimina un grupo completo: sus eventos (por cascada en la base de datos)
 * y el Excel que se hubiera subido a la nube (manager).
 */
export async function deleteGrupo(id: string, nombre: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.from('grupos').delete().eq('id', id);
  if (error) throw new Error(error.message);
  // Limpieza de respaldos y del Excel: cada paso es independiente y tolera
  // fallos, para que un fallo no impida el resto de borrados.
  let prevExcel: string | null = null;
  try {
    prevExcel = await trackedExcelName(id);
  } catch {
    prevExcel = null;
  }
  await Promise.allSettled([
    restDeleteConfig(FECHAS_KEY(id)),
    restDeleteConfig(EXCEL_KEY(id)),
    storageRemoveFile(prevExcel ?? `${slug(nombre)}.xlsx`),
  ]);
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

/**
 * Sube el Excel del grupo y devuelve su URL pública. El seguimiento del
 * archivo (para borrar el anterior al renombrar) se hace en segundo plano:
 * nunca retrasa la respuesta ni la apertura de Excel web.
 */
export async function uploadExcel(
  grupoId: string,
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
  // Seguimiento del archivo en segundo plano: NUNCA retrasa la respuesta
  // (ni la apertura de Excel web). Si el cliente se queda bloqueado, no
  // pasa nada: el archivo ya está subido.
  void (async () => {
    try {
      const prev = await trackedExcelName(grupoId);
      if (prev && prev !== path) {
        await storageRemoveFile(prev);
      }
      await trackExcelName(grupoId, path);
    } catch {
      /* el seguimiento es opcional: no afecta a la subida */
    }
  })();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** URL pública del Excel vigente del grupo (para el botón de Excel web). */
export async function getExcelPublicUrl(grupoId: string): Promise<string | null> {
  if (!supabase) return null;
  const name = await trackedExcelName(grupoId).catch(() => null);
  if (!name) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
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
    fechaDesde: (r.fecha_desde as string | null) ?? '',
    fechaHasta: (r.fecha_hasta as string | null) ?? '',
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