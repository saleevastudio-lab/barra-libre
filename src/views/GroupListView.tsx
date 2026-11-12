import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, KeyRound, Settings as SettingsIcon } from 'lucide-react';
import type { Grupo, TelegramSettings } from '@/lib/types';
import { createGrupo, listGrupos, subscribeGrupos, supabaseConfigured } from '@/lib/supabase';
import { isManagerSession, loadSettings, saveSettings, setManagerSession } from '@/lib/store';
import { Notice, ViewHeader } from '@/views/ui';
import { PinDialog } from '@/views/PinDialog';
import { SettingsDialog } from '@/sections/SettingsDialog';

/**
 * Pantalla de entrada: lista de grupos (un grupo = un Excel compartido).
 * El manager crea el grupo (Nº OS + nombre) y los supervisores entran a
 * rellenar consumiciones.
 */
export function GroupListView() {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [os, setOs] = useState('');
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [isManager, setIsManager] = useState(() => isManagerSession());
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
    setBusy(true);
    setError(null);
    try {
      const g = await createGrupo({ nombre: nombre.trim(), os: os.trim() });
      navigate(`/g/${g.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el grupo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <ViewHeader
        title="Consumiciones"
        subtitle="Grupos / eventos"
        right={
          <>
            {!isManager && (
              <button
                onClick={() => setPinOpen(true)}
                aria-label="Acceso manager"
                className="h-9 w-9 inline-flex items-center justify-center border border-border hover:bg-foreground hover:text-background transition-colors cursor-pointer"
              >
                <KeyRound className="h-4 w-4" />
              </button>
            )}
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

        <section>
          {!isManager ? (
            <p className="border border-dashed border-border px-4 py-4 font-data text-xs uppercase tracking-wide text-muted-foreground text-center">
              Crear grupos es tarea del manager (icono de la llave arriba a
              la derecha). Los supervisores solo rellenan consumiciones de los
              grupos existentes.
            </p>
          ) : (
          <>
          <button
            onClick={() => setCreating((v) => !v)}
            className="w-full h-12 border border-dashed border-border font-data text-xs uppercase tracking-wide hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Nuevo grupo (Nº OS + nombre)
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
              <label className="flex flex-col gap-1">
                <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                  Nº OS
                </span>
                <input
                  value={os}
                  onChange={(e) => setOs(e.target.value)}
                  placeholder="OS-2026-001"
                  className={inputCls}
                />
              </label>
              <button
                onClick={create}
                disabled={busy || !nombre.trim() || !supabaseConfigured}
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
              {grupos.map((g) => (
                <li key={g.id}>
                  <Link
                    to={`/g/${g.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-foreground/5 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold uppercase truncate">
                        {g.nombre || '(sin nombre)'}
                      </p>
                      <p className="font-data text-xs text-muted-foreground">
                        {g.os ? `OS ${g.os}` : 'sin OS'}
                        {g.fechaAnalisis ? ` · ${g.fechaAnalisis}` : ''}
                      </p>
                    </div>
                    <span className="font-data text-xs uppercase text-muted-foreground shrink-0">
                      Abrir →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <PinDialog
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        onSuccess={() => {
          setManagerSession(true);
          setIsManager(true);
          setPinOpen(false);
        }}
      />
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
