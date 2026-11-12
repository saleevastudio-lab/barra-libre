import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  KeyRound,
  Plus,
  FileSpreadsheet,
  Pencil,
  UtensilsCrossed,
  Wine,
} from 'lucide-react';
import type { EventoDraft, Grupo } from '@/lib/types';
import {
  MAX_EVENTOS_POR_GRUPO,
} from '@/lib/catalog';
import { previewEvento, previewGrupo } from '@/lib/calc';
import {
  createEvento,
  getGrupo,
  listEventos,
  subscribeGrupo,
  supabaseConfigured,
  updateGrupo,
  uploadExcel,
} from '@/lib/supabase';
import { generateExcel, excelFileName } from '@/lib/excel';
import { isManagerSession, setManagerSession } from '@/lib/store';
import { eur, Notice, ViewHeader } from '@/views/ui';
import { PinDialog } from '@/views/PinDialog';

const ESTADO_LABEL: Record<string, string> = {
  'sin-ingresos': 'Sin ingresos',
  'falta-tipo': 'Falta tipo',
  'en-objetivo': 'En objetivo',
  ajustado: 'Ajustado',
  bajo: 'Bajo objetivo',
};

function EstadoChip({ estado }: { estado: string }) {
  if (!estado) return null;
  const color =
    estado === 'en-objetivo'
      ? 'bg-primary/15 text-primary border-primary/50'
      : estado === 'ajustado'
        ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/50'
        : 'bg-destructive/15 text-destructive border-destructive/50';
  return (
    <span
      className={`font-data text-[10px] uppercase tracking-wide border px-1.5 py-0.5 ${color}`}
    >
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  );
}

/**
 * Vista de un grupo: datos del grupo (manager) + lista de eventos.
 * Cada evento es una pestaña del Excel; supervisores rellenan comida/bebida,
 * el manager rellena los datos económicos y genera el Excel del grupo.
 */
export function GroupView() {
  const { gid = '' } = useParams();
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [eventos, setEventos] = useState<EventoDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(() => isManagerSession());
  const [pinOpen, setPinOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Datos editables del grupo (solo manager)
  const [responsable, setResponsable] = useState('');
  const [fechaAnalisis, setFechaAnalisis] = useState('');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true;
    const reload = () => {
      getGrupo(gid).then((g) => alive && setGrupo(g));
      listEventos(gid)
        .then((evs) => alive && setEventos(evs))
        .catch((e) => alive && setError(e instanceof Error ? e.message : 'Error de carga'));
    };
    reload();
    const unsub = subscribeGrupo(gid, reload);
    return () => {
      alive = false;
      unsub();
    };
  }, [gid]);

  useEffect(() => {
    if (grupo) {
      setResponsable(grupo.responsable);
      setFechaAnalisis(grupo.fechaAnalisis);
      setObservaciones(grupo.observaciones);
    }
  }, [grupo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const totales = useMemo(() => previewGrupo(eventos ?? []), [eventos]);

  const addEvento = async () => {
    if (!eventos) return;
    setBusy(true);
    setError(null);
    try {
      await createEvento(gid, eventos.length + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el evento');
    } finally {
      setBusy(false);
    }
  };

  const saveGrupo = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateGrupo(gid, { responsable, fechaAnalisis, observaciones });
      setEditOpen(false);
      setNotice('Datos del grupo guardados.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const generarExcel = async () => {
    if (!grupo || !eventos) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const blob = await generateExcel(grupo, eventos);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = excelFileName(grupo);
      a.click();
      URL.revokeObjectURL(a.href);
      const url = await uploadExcel(grupo.nombre || 'GRUPO', blob);
      setNotice(`Excel guardado en la nube: ${url}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el Excel');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <ViewHeader
        title={grupo?.nombre ?? 'Grupo'}
        subtitle={grupo?.os ? `OS ${grupo.os}` : undefined}
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
              <>
                <button
                  onClick={() => setEditOpen((v) => !v)}
                  aria-label="Editar datos del grupo"
                  className="h-9 w-9 inline-flex items-center justify-center border border-border hover:bg-foreground hover:text-background transition-colors cursor-pointer"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={generarExcel}
                  disabled={busy || !eventos}
                  aria-label="Generar Excel del grupo"
                  className="h-9 px-3 inline-flex items-center gap-2 border border-primary text-primary font-data text-xs uppercase tracking-wide hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-default"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden sm:inline">Excel</span>
                </button>
              </>
            )}
            <Link
              to="/"
              aria-label="Volver a grupos"
              className="h-9 w-9 inline-flex items-center justify-center border border-border hover:bg-foreground hover:text-background transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
        {!supabaseConfigured && (
          <Notice msg="Supabase no configurado: no se pueden cargar ni guardar borradores." />
        )}
        {error && <Notice msg={error} />}
        {notice && <Notice msg={notice} />}

        {isManager && editOpen && (
          <section className="border border-border p-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                Responsable comercial
              </span>
              <input
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                Fecha del análisis
              </span>
              <input
                type="date"
                value={fechaAnalisis}
                onChange={(e) => setFechaAnalisis(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                Observaciones (hoja Resumen)
              </span>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className={inputCls + ' py-2 h-auto'}
              />
            </label>
            <button
              onClick={saveGrupo}
              disabled={busy}
              className="h-12 bg-primary text-primary-foreground font-data text-xs uppercase tracking-wide font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer disabled:cursor-default"
            >
              {busy ? 'Guardando…' : 'Guardar datos del grupo'}
            </button>
          </section>
        )}

        <section aria-label="Totales del grupo">
          <dl className="border border-border divide-y divide-border">
            <div className="flex justify-between items-baseline px-4 py-2.5">
              <dt className="text-sm">Facturación neta del grupo</dt>
              <dd className="font-data text-sm">{eur(totales.neta)}</dd>
            </div>
            <div className="flex justify-between items-baseline px-4 py-2.5">
              <dt className="text-sm">Coste total</dt>
              <dd className="font-data text-sm">{eur(totales.coste)}</dd>
            </div>
            <div className="flex justify-between items-baseline px-4 py-2.5 bg-primary text-primary-foreground">
              <dt className="text-sm font-semibold uppercase">Beneficio</dt>
              <dd className="font-data font-bold">
                {eur(totales.beneficio)} ({(totales.margen * 100).toFixed(1)} %)
              </dd>
            </div>
          </dl>
        </section>

        <section aria-label="Eventos del grupo">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-data text-xs uppercase tracking-widest text-muted-foreground">
              Eventos ({eventos?.length ?? 0}/{MAX_EVENTOS_POR_GRUPO})
            </h2>
            {isManager && (
              <button
                onClick={addEvento}
                disabled={
                  busy || !eventos || eventos.length >= MAX_EVENTOS_POR_GRUPO
                }
                className="h-9 px-3 inline-flex items-center gap-2 border border-border font-data text-xs uppercase tracking-wide hover:border-primary hover:text-primary transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-default"
              >
                <Plus className="h-4 w-4" /> Añadir evento
              </button>
            )}
          </div>

          {eventos === null ? (
            <p className="font-data text-sm text-muted-foreground">Cargando…</p>
          ) : eventos.length === 0 ? (
            <p className="font-data text-sm text-muted-foreground border border-dashed border-border px-4 py-8 text-center">
              {isManager
                ? 'Grupo vacío: pulsa «Añadir evento» para crear el borrador.'
                : 'El manager aún no ha creado ningún evento para este grupo.'}
            </p>
          ) : (
            <ul className="border border-border divide-y divide-border">
              {eventos.map((ev) => {
                const p = previewEvento(ev);
                return (
                  <li key={ev.id} className="px-4 py-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold uppercase truncate">
                          {ev.orden} · {ev.nombre || `Evento ${ev.orden}`}
                        </p>
                        <p className="font-data text-xs text-muted-foreground">
                          {ev.tipo || 'sin tipo'}
                          {ev.fecha ? ` · ${ev.fecha}` : ''}
                          {ev.updatedAt
                            ? ` · act. ${new Date(ev.updatedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                            : ''}
                        </p>
                      </div>
                      <EstadoChip estado={p.estado} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/g/${gid}/e/${ev.id}/comida`}
                        className="h-10 px-3 inline-flex items-center gap-2 border border-border font-data text-xs uppercase tracking-wide hover:border-primary hover:text-primary transition-colors"
                      >
                        <UtensilsCrossed className="h-4 w-4" /> Comida
                      </Link>
                      <Link
                        to={`/g/${gid}/e/${ev.id}/bebida`}
                        className="h-10 px-3 inline-flex items-center gap-2 border border-border font-data text-xs uppercase tracking-wide hover:border-primary hover:text-primary transition-colors"
                      >
                        <Wine className="h-4 w-4" /> Bebida
                      </Link>
                      {isManager && (
                        <Link
                          to={`/g/${gid}/e/${ev.id}/manager`}
                          className="h-10 px-3 inline-flex items-center gap-2 border border-border font-data text-xs uppercase tracking-wide hover:border-primary hover:text-primary transition-colors"
                        >
                          <Pencil className="h-4 w-4" /> Datos
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
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
    </div>
  );
}

const inputCls =
  'w-full h-11 px-3 bg-card border border-input font-data text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'placeholder:text-muted-foreground';
