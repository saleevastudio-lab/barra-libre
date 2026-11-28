import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Plus, Send, Shirt, Trash2 } from 'lucide-react';
import type {
  EventoDraft,
  Grupo,
  LavanderiaLine,
  TelegramSettings,
} from '@/lib/types';
import { LAVANDERIA_ANTERIORES, LAVANDERIA_TARIFAS } from '@/lib/catalog';
import { lavanderiaResumen } from '@/lib/calc';
import {
  getGrupo,
  getLavanderiaPrecios,
  listEventos,
  saveLavanderiaPrecios,
  supabaseConfigured,
  updateEvento,
} from '@/lib/supabase';
import { buildConstancia, sendTelegram } from '@/lib/telegram';
import { currentUserName, isManagerSession, loadSettings } from '@/lib/store';
import { eur, Notice, ViewHeader } from '@/views/ui';

/**
 * Conteo de mantelería/lavandería de un evento (servilletas, manteles,
 * pasillos, manteles de lino…). Los supervisores meten cantidades; el
 * manager fija el precio por unidad de cada artículo (se guarda para la
 * próxima vez, pero se puede editar). En el Excel solo hay un apartado de
 * lavandería: se escribe el total de piezas con el precio medio ponderado.
 */
export function LavanderiaView() {
  const { gid = '', eid = '' } = useParams();
  const isManager = isManagerSession();

  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [evento, setEvento] = useState<EventoDraft | null>(null);
  const [lines, setLines] = useState<LavanderiaLine[]>([]);
  const [precios, setPrecios] = useState<Record<string, number>>({});
  const [editingQty, setEditingQty] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [nuevoItem, setNuevoItem] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const loadedRef = useRef(false);
  const initialLinesRef = useRef<LavanderiaLine[]>([]);
  const pendingPricesRef = useRef(new Map<string, number>());
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  /** Une el catálogo (con precios guardados) con los conteos ya registrados. */
  const buildLines = (
    saved: LavanderiaLine[],
    preciosMap: Record<string, number>,
  ): LavanderiaLine[] => {
    const tarifas = new Map(LAVANDERIA_TARIFAS.map(({ item, precio }) => [item, precio]));
    const items = [...tarifas.keys()];
    for (const k of Object.keys(preciosMap)) {
      if (!items.includes(k) && !LAVANDERIA_ANTERIORES.includes(k)) items.push(k);
    }
    const out: LavanderiaLine[] = items.map((item) => {
      const sv = saved.find((l) => l.item === item);
      return {
        item,
        cantidad: sv?.cantidad ?? 0,
        precio:
          sv && sv.cantidad > 0
            ? sv.precio
            : preciosMap[item] || tarifas.get(item) || sv?.precio || 0,
      };
    });
    for (const sv of saved) {
      if (items.includes(sv.item)) continue;
      if (LAVANDERIA_ANTERIORES.includes(sv.item) && sv.cantidad <= 0) continue;
      out.push({ ...sv });
    }
    return out;
  };

  useEffect(() => {
    loadedRef.current = false;
    pendingPricesRef.current = new Map();
    if (!supabaseConfigured) return;
    let alive = true;
    getGrupo(gid).then((g) => alive && setGrupo(g));
    Promise.all([listEventos(gid), getLavanderiaPrecios()])
      .then(([evs, preciosMap]) => {
        if (!alive) return;
        const ev = evs.find((e) => e.id === eid);
        setEvento(ev ?? null);
        setPrecios(preciosMap);
        const initialLines = buildLines(ev?.lavanderia ?? [], preciosMap);
        initialLinesRef.current = initialLines;
        setLines(initialLines);
        loadedRef.current = true;
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Error de carga'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, eid]);

  const setLine = (i: number, patch: Partial<LavanderiaLine>) => {
    if (patch.precio !== undefined) {
      pendingPricesRef.current.set(lines[i].item, patch.precio);
    }
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };

  const resumen = useMemo(() => lavanderiaResumen(lines), [lines]);
  const sinPrecio = useMemo(
    () => lines.filter((l) => l.item.trim() && l.cantidad > 0 && !(l.precio > 0)),
    [lines],
  );

  const persist = async () => {
    if (!evento) return;
    setSaveState('saving');
    setError(null);
    try {
      const limpias = lines.filter(
        (l) => l.item.trim() !== '' && l.cantidad > 0,
      );
      await updateEvento(evento.id, { lavanderia: limpias });
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  };

  // Autoguardado del conteo (600 ms después de la última pulsación).
  useEffect(() => {
    if (!loadedRef.current || !evento || lines === initialLinesRef.current) return;
    const t = setTimeout(persist, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  // Autoguardado de los precios que edite el manager (se guardan para la
  // próxima vez que se meta mantelería).
  useEffect(() => {
    if (!loadedRef.current || !isManager || !supabaseConfigured) return;
    const t = setTimeout(async () => {
      try {
        const pending = pendingPricesRef.current;
        if (pending.size === 0) return;
        const edited = new Map(pending);
        const map = { ...precios, ...Object.fromEntries(edited) };
        await saveLavanderiaPrecios(map);
        if (pendingPricesRef.current !== pending) return;
        for (const [item, precio] of edited) {
          if (pending.get(item) === precio) pending.delete(item);
        }
        setPrecios(map);
      } catch {
        /* los precios se reintentan en la próxima edición */
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  const addItem = () => {
    const item = nuevoItem.trim();
    if (!item) return;
    if (lines.some((l) => l.item.toLowerCase() === item.toLowerCase())) {
      setError(`«${item}» ya está en la lista.`);
      return;
    }
    const precio = Math.max(0, Number(nuevoPrecio.replace(',', '.')) || 0);
    setError(null);
    pendingPricesRef.current.set(item, precio);
    setLines((ls) => [...ls, { item, cantidad: 0, precio }]);
    setNuevoItem('');
    setNuevoPrecio('');
  };

  const removeItem = (i: number) => {
    const item = lines[i]?.item;
    setLines((ls) => ls.filter((_, j) => j !== i));
    if (item) {
      pendingPricesRef.current.delete(item);
      setPrecios((p) => {
        const next = { ...p };
        delete next[item];
        saveLavanderiaPrecios(next).catch(() => {});
        return next;
      });
    }
  };

  const send = async () => {
    if (!grupo || !evento) return;
    const settings: TelegramSettings = loadSettings();
    if (!settings.botToken || !settings.chatId) {
      setError('Falta configurar el bot de Telegram (botón ⚙ en la lista de grupos).');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const conTotal = lines
        .filter((l) => l.item.trim() && l.cantidad > 0)
        .map((l) => ({
          nombre: l.item,
          cantidad: l.cantidad,
          coste: l.precio,
          total: l.cantidad * (l.precio || 0),
        }));
      await sendTelegram(
        settings,
        buildConstancia(
          grupo,
          evento,
          'manteleria',
          conTotal,
          resumen.coste,
          currentUserName(),
        ),
      );
      showNotice('Constancia enviada a Telegram.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar a Telegram');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <ViewHeader
        title="Mantelería"
        subtitle={
          evento
            ? `${evento.nombre || `Evento ${evento.orden}`}${grupo ? ` · ${grupo.nombre}` : ''}`
            : undefined
        }
        right={
          <>
            <span
              role="status"
              className={`h-9 px-2 inline-flex items-center font-data text-[10px] uppercase tracking-wide ${
                saveState === 'saving'
                  ? 'text-muted-foreground'
                  : saveState === 'saved'
                    ? 'text-primary'
                    : saveState === 'error'
                      ? 'text-destructive'
                      : 'text-muted-foreground/50'
              }`}
            >
              {saveState === 'saving'
                ? 'Guardando…'
                : saveState === 'saved'
                  ? '✓ Guardado'
                  : saveState === 'error'
                    ? 'Error al guardar'
                    : 'Autoguardado'}
            </span>
            <button
              onClick={send}
              disabled={sending || resumen.piezas <= 0}
              aria-label="Enviar constancia a Telegram"
              className="h-9 px-3 inline-flex items-center gap-2 border border-border font-data text-xs uppercase tracking-wide hover:border-primary hover:text-primary transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-default"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Constancia</span>
            </button>
            <Link
              to={`/g/${gid}`}
              aria-label="Volver al grupo"
              className="h-9 w-9 inline-flex items-center justify-center border border-border hover:bg-foreground hover:text-background transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">
        {!supabaseConfigured && (
          <Notice msg="Supabase no configurado: los cambios no se guardarán." />
        )}
        {error && <Notice msg={error} />}
        {notice && <Notice msg={notice} />}
        {sinPrecio.length > 0 && (
          <Notice
            msg={`Aviso: falta el precio de ${sinPrecio
              .map((l) => l.item)
              .join(', ')}. El manager lo puede poner aquí mismo.`}
          />
        )}

        {lines.length === 0 && (
          <p className="font-data text-sm text-muted-foreground border border-dashed border-border px-4 py-8 text-center">
            Sin artículos todavía: el manager puede añadir el primero abajo.
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {lines.map((l, i) => {
            const tarifa = LAVANDERIA_TARIFAS.find(({ item }) => item === l.item);
            const anterior = LAVANDERIA_ANTERIORES.includes(l.item);
            return (
              <li
                key={`${l.item}-${i}`}
                className="border border-border bg-card p-3 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <Shirt className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{l.item}</p>
                    {tarifa && (
                      <p className="font-data text-xs text-muted-foreground">{tarifa.id}</p>
                    )}
                    {anterior && (
                      <p className="text-xs text-muted-foreground">Recuento anterior</p>
                    )}
                  </div>
                  {isManager && (
                    <button
                      onClick={() => removeItem(i)}
                      aria-label={`Quitar ${l.item}`}
                      className="h-10 w-10 shrink-0 inline-flex items-center justify-center border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-data text-xs uppercase tracking-wide text-muted-foreground w-16">
                    Cant.
                  </span>
                  {editingQty === i ? (
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      autoFocus
                      defaultValue={l.cantidad || ''}
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => {
                        setLine(i, {
                          cantidad: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        });
                        setEditingQty(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      className="w-20 h-10 px-1 text-center bg-background border border-primary font-data text-sm focus-visible:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingQty(i)}
                      className="w-16 h-10 text-center bg-background border border-input font-data text-sm hover:border-primary transition-colors cursor-pointer"
                    >
                      {l.cantidad}
                    </button>
                  )}
                  <span className="font-data text-xs text-muted-foreground">unidades</span>
                  <span className="ml-6 font-data text-xs uppercase tracking-wide text-muted-foreground">
                    Precio
                  </span>
                  {isManager ? (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={l.precio || ''}
                      placeholder="0,00"
                      onChange={(e) =>
                        setLine(i, {
                          precio:
                            e.target.value === '' ? 0 : Number(e.target.value),
                        })
                      }
                      className="w-24 h-10 px-2 bg-background border border-input font-data text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  ) : (
                    <span className="font-data text-sm w-24">
                      {l.precio > 0 ? eur(l.precio) : '—'}
                    </span>
                  )}
                  <span className="font-data text-xs text-muted-foreground">€ / ud</span>
                  <span className="ml-auto font-data text-sm">
                    {l.cantidad > 0 && l.precio > 0 ? eur(l.cantidad * l.precio) : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        {isManager && (
          <section className="border border-dashed border-border p-3 flex flex-col gap-3">
            <p className="font-data text-[10px] uppercase tracking-wide text-muted-foreground">
              Añadir artículo de mantelería (el precio se guarda para la próxima
              vez; puedes corregirlo en cualquier momento)
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={nuevoItem}
                onChange={(e) => setNuevoItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                placeholder="Nuevo artículo (p. ej. Delantales)"
                className="flex-1 min-w-40 h-10 px-3 bg-background border border-input font-data text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={nuevoPrecio}
                onChange={(e) => setNuevoPrecio(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                placeholder="€/ud"
                className="w-24 h-10 px-2 bg-background border border-input font-data text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                onClick={addItem}
                className="h-10 px-3 inline-flex items-center gap-2 border border-border font-data text-xs uppercase tracking-wide hover:border-primary hover:text-primary transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Añadir
              </button>
            </div>
          </section>
        )}

        <div className="flex justify-between items-baseline border border-border bg-card px-4 py-3 mt-2">
          <span className="font-data text-xs uppercase tracking-widest text-muted-foreground">
            Total mantelería
          </span>
          <span className="font-data text-lg font-bold">
            {resumen.piezas} pzas · {eur(resumen.coste)}
            {resumen.piezas > 0 && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                (media {eur(resumen.precioMedio)}/ud)
              </span>
            )}
          </span>
        </div>
        <p className="font-data text-[10px] uppercase tracking-wide text-muted-foreground text-center">
          En el Excel se escribe como: {resumen.piezas} piezas ×{' '}
          {eur(resumen.precioMedio)} de media (apartado Lavandería).
        </p>
      </main>
    </div>
  );
}