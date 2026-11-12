import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Plus, Send, Trash2 } from 'lucide-react';
import type { CostLine, EventoDraft, Grupo, TelegramSettings } from '@/lib/types';
import { DRINKS, MAX_LINEAS_ESCANDALLO, PLATOS } from '@/lib/catalog';
import { getGrupo, listEventos, supabaseConfigured, updateEvento } from '@/lib/supabase';
import { buildConstancia, sendTelegram } from '@/lib/telegram';
import { loadSettings } from '@/lib/store';
import { eur, Notice, ViewHeader } from '@/views/ui';

type Kind = 'comida' | 'bebida';

/**
 * Editor de escandallo (comida = cocina / bebida = barra) de un evento.
 * Los supervisores rellenan solo cantidades; el coste se toma del catálogo
 * automáticamente (los refrescos se cuentan por cajas de 24).
 */
export function EscandalloView() {
  const { gid = '', eid = '', kind = 'comida' } = useParams();
  const seccion: Kind = kind === 'bebida' ? 'bebida' : 'comida';

  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [evento, setEvento] = useState<EventoDraft | null>(null);
  const [lines, setLines] = useState<CostLine[]>([]);
  const [editingQty, setEditingQty] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true;
    getGrupo(gid).then((g) => alive && setGrupo(g));
    listEventos(gid)
      .then((evs) => {
        if (!alive) return;
        const ev = evs.find((e) => e.id === eid);
        setEvento(ev ?? null);
        setLines(ev ? [...ev[seccion]] : []);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Error de carga'));
    return () => {
      alive = false;
    };
    // El editor no se recarga en vivo mientras se edita (evita pisar cambios).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, eid, seccion]);

  const catalog = seccion === 'bebida' ? DRINKS : null;
  const sugeridos = seccion === 'comida' ? PLATOS : DRINKS.map((d) => d.name);
  const listId = `cat-${seccion}`;

  const total = useMemo(
    () =>
      lines.reduce((a, l) => {
        if (!l.nombre.trim() || l.cantidad <= 0) return a;
        return a + l.cantidad * (l.coste ?? 0);
      }, 0),
    [lines],
  );

  const setLine = (i: number, patch: Partial<CostLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const onPickName = (i: number, nombre: string) => {
    const patch: Partial<CostLine> = { nombre };
    if (catalog) {
      const hit = catalog.find(
        (d) => d.name.toLowerCase() === nombre.trim().toLowerCase(),
      );
      if (hit) {
        patch.coste = hit.unitCost;
        patch.esCaja = hit.unit === 'caja';
      }
    }
    setLine(i, patch);
  };

  const save = async () => {
    if (!evento) return;
    setSaving(true);
    setError(null);
    try {
      const limpias = lines.filter((l) => l.nombre.trim() !== '');
      await updateEvento(evento.id, { [seccion]: limpias });
      setLines(limpias);
      showNotice('Guardado en el borrador compartido.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
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
        .filter((l) => l.nombre.trim() && l.cantidad > 0)
        .map((l) => ({
          nombre: l.esCaja ? `${l.nombre} (caja ×24)` : l.nombre,
          cantidad: l.cantidad,
          coste: l.coste,
          total: l.cantidad * (l.coste ?? 0),
        }));
      await sendTelegram(
        settings,
        buildConstancia(grupo, evento, seccion, conTotal, total),
      );
      showNotice('Constancia enviada a Telegram.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar a Telegram');
    } finally {
      setSending(false);
    }
  };

  const titulo = seccion === 'comida' ? 'Comida / cocina' : 'Bebida / barra';

  return (
    <div className="min-h-dvh">
      <ViewHeader
        title={titulo}
        subtitle={
          evento
            ? `${evento.nombre || `Evento ${evento.orden}`}${grupo ? ` · ${grupo.nombre}` : ''}`
            : undefined
        }
        right={
          <>
            <button
              onClick={send}
              disabled={sending || total <= 0}
              aria-label="Enviar constancia a Telegram"
              className="h-9 px-3 inline-flex items-center gap-2 border border-border font-data text-xs uppercase tracking-wide hover:border-primary hover:text-primary transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-default"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Constancia</span>
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="h-9 px-3 inline-flex items-center gap-2 bg-primary text-primary-foreground font-data text-xs uppercase tracking-wide font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer disabled:cursor-default"
            >
              {saving ? 'Guardando…' : 'Guardar'}
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

        <datalist id={listId}>
          {sugeridos.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        {lines.length === 0 && (
          <p className="font-data text-sm text-muted-foreground border border-dashed border-border px-4 py-8 text-center">
            Sin líneas todavía: añade la primera con el botón de abajo.
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <li
              key={i}
              className="border border-border bg-card p-3 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <input
                  value={l.nombre}
                  onChange={(e) => setLine(i, { nombre: e.target.value })}
                  onBlur={(e) => onPickName(i, e.target.value)}
                  list={listId}
                  placeholder={
                    seccion === 'comida' ? 'Plato / elaboración' : 'Artículo de bodega'
                  }
                  className="flex-1 min-w-0 h-10 px-3 bg-background border border-input font-data text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  aria-label="Quitar línea"
                  className="h-10 w-10 shrink-0 inline-flex items-center justify-center border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
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
                <span className="font-data text-xs text-muted-foreground">
                  {l.esCaja ? 'cajas ×24' : 'unidades'}
                </span>
                {seccion === 'bebida' && (
                  <label className="ml-auto inline-flex items-center gap-2 font-data text-xs uppercase tracking-wide text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(l.esCaja)}
                      onChange={(e) => setLine(i, { esCaja: e.target.checked })}
                      className="h-4 w-4 accent-[hsl(137,100%,55%)]"
                    />
                    por caja
                  </label>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-data text-xs uppercase tracking-wide text-muted-foreground w-16">
                  Coste
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={l.coste ?? ''}
                  placeholder={catalog ? 'del catálogo' : 'manual'}
                  onChange={(e) =>
                    setLine(i, {
                      coste: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-28 h-10 px-2 bg-background border border-input font-data text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="font-data text-xs text-muted-foreground">
                  € / {l.esCaja ? 'caja' : 'ud'}
                </span>
                <span className="ml-auto font-data text-sm">
                  {l.cantidad > 0 && l.coste != null ? eur(l.cantidad * l.coste) : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {lines.length < MAX_LINEAS_ESCANDALLO && (
          <button
            onClick={() =>
              setLines((ls) => [
                ...ls,
                { nombre: '', cantidad: 0, coste: null, esCaja: seccion === 'bebida' },
              ])
            }
            className="h-12 border border-dashed border-border font-data text-xs uppercase tracking-wide hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Añadir línea
          </button>
        )}

        <div className="flex justify-between items-baseline border border-border bg-card px-4 py-3 mt-2">
          <span className="font-data text-xs uppercase tracking-widest text-muted-foreground">
            Total {seccion}
          </span>
          <span className="font-data text-lg font-bold">{eur(total)}</span>
        </div>
      </main>
    </div>
  );
}
