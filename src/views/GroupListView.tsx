import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import type { Grupo, TelegramSettings } from '@/lib/types';
import { createGrupo, deleteGrupo, listGrupos, subscribeGrupos, supabaseConfigured } from '@/lib/supabase';
import { isManagerSession, loadSettings, saveSettings } from '@/lib/store';
import { Notice, ViewHeader } from '@/views/ui';
import { SettingsDialog } from '@/sections/SettingsDialog';

/**
 * Pantalla de entrada: lista de grupos (un grupo = un Excel compartido).
 * El manager crea el grupo (nombre + fechas DESDE/HASTA; Nº OS opcional),
 * elimina grupos y los supervisores entran a rellenar consumiciones.
 */
export function GroupListView() {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [os, setOs] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busy, setBusy] = useState(false);
  const [isManager] = useState(() => isManagerSession());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<TelegramSettings>(() => loadSettings());
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true;
    listGrupos()
      .then((g) => alive && setGrupos(g))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Error de carga'));
    const unsub = subscribeGrupos(() => {
      listGrupos()
        .then((g) => alive && setGrupos(g))
        .catch(() => {});
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const create = async () => {
    if (!nombre.trim()) return;
    if (fechaDesde && fechaHasta && fechaHasta < fechaDesde) {
      setError('La fecha HASTA no puede ser anterior a la fecha DESDE.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const g = await createGrupo({
        nombre: nombre.trim(),
        os: os.trim(),
        fechaDesde,
        fechaHasta,
      });
      navigate(`/g/${g.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el grupo');
    } finally {
      setBusy(false);
    }
  };

  /** Manager: elimina un grupo completo tras confirmarlo. */
  const removeGrupo = async (grupo: Grupo) => {
    const etiqueta = grupo.nombre?.trim() || 'grupo';
    if (
      !window.confirm(
        `¿Eliminar el grupo «${etiqueta}» y todos sus eventos? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setError(null);
    setNotice(null);
    try {
      await deleteGrupo(grupo.id, grupo.nombre);
      setGrupos((gs) => (gs ? gs.filter((x) => x.id !== grupo.id) : gs));
      setNotice(`Grupo «${etiqueta}» eliminado.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el grupo');
    }
  };

  return (
    <div className="min-h-dvh">
      <ViewHeader
        title="Consumiciones"
        subtitle="Grupos / eventos"
        right={
          <>
            {isManager && (
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Configuración"
                className="h-9 w-9 inline-flex items-center justify-center border border-border hover:bg-foreground hover:text-background transition-colors cursor-pointer"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
            )}
          </>
        }
      />

      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
        {!supabaseConfigured && (
          <Notice msg="Falta configurar Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY) en el build. Sin ellas la app no puede guardar borradores." />
        )}
        {error && <Notice msg={error} />}
        {notice && <Notice msg={notice} />}

        <section>
          {!isManager ? (
            <p className="border border-dashed border-border px-4 py-4 font-data text-xs uppercase tracking-wide text-muted-foreground text-center">
              Crear grupos es tarea del manager (entra con el código de
              manager). Los supervisores solo rellenan consumiciones de los
              grupos existentes.
            </p>
          ) : (
          <>
          <button
            onClick={() => setCreating((v) => !v)}
            className="w-full h-12 border border-dashed border-border font-data text-xs uppercase tracking-wide hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Nuevo grupo
          </button>
          {creating && (
            <div className="mt-3 border border-border p-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                  Nombre del grupo / cliente
                </span>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Closerstill, Boda García…"
                  className={inputCls}
                  autoFocus
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                    Fecha desde
                  </span>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                    Fecha hasta
                  </span>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                  Nº OS (opcional)
                </span>
                <input
                  value={os}
                  onChange={(e) => setOs(e.target.value)}
                  placeholder="Opcional — OS-2026-001"
                  className={inputCls}
                />
              </label>
              <button
                onClick={create}
                disabled={
                  busy ||
                  !nombre.trim() ||
                  !fechaDesde ||
                  !fechaHasta ||
                  !supabaseConfigured
                }
                className="h-12 bg-primary text-primary-foreground font-data text-xs uppercase tracking-wide font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer disabled:cursor-default"
              >
                {busy ? 'Creando…' : 'Crear grupo'}
              </button>
            </div>
          )}
          </>
          )}
        </section>

        <section aria-label="Grupos">
          <h2 className="font-data text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Grupos activos
          </h2>
          {grupos === null ? (
            <p className="font-data text-sm text-muted-foreground">Cargando…</p>
          ) : grupos.length === 0 ? (
            <p className="font-data text-sm text-muted-foreground border border-dashed border-border px-4 py-8 text-center">
              {isManager
                ? 'Todavía no hay grupos. Crea el primero con el botón de arriba.'
                : 'Todavía no hay grupos. El manager los creará con su acceso.'}
            </p>
          ) : (
            <ul className="border border-border divide-y divide-border">
              {grupos.map((g) => {
                const detalle = [
                  g.os ? `OS ${g.os}` : null,
                  g.fechaDesde && g.fechaHasta
                    ? `${g.fechaDesde} → ${g.fechaHasta}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                <li key={g.id} className="flex items-stretch">
                  <Link
                    to={`/g/${g.id}`}
                    className="flex-1 min-w-0 flex items-center justify-between gap-3 px-4 py-4 hover:bg-foreground/5 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold uppercase truncate">
                        {g.nombre || '(sin nombre)'}
                      </p>
                      <p className="font-data text-xs text-muted-foreground">
                        {detalle || 'sin OS ni fechas'}
                      </p>
                    </div>
                    <span className="font-data text-xs uppercase text-muted-foreground shrink-0">
                      Abrir →
                    </span>
                  </Link>
                  {isManager && (
                    <button
                      onClick={() => removeGrupo(g)}
                      aria-label={`Eliminar ${g.nombre || 'grupo'}`}
                      title="Eliminar grupo y todos sus eventos"
                      className="px-4 border-l border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={(s) => {
          setSettings(s);
          saveSettings(s);
        }}
      />
    </div>
  );
}

const inputCls =
  'w-full h-11 px-3 bg-card border border-input font-data text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'placeholder:text-muted-foreground';