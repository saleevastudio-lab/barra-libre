import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import type {
  CategoriaIngreso,
  EventoDraft,
  Grupo,
  IncomeLine,
  PersonalDraft,
  VariosLine,
} from '@/lib/types';
import { MAX_INGRESOS, TIPOS_SERVICIO, VARIOS_CONCEPTOS } from '@/lib/catalog';
import { euroSlices, previewEvento, type EventoPreview } from '@/lib/calc';
import { getGrupo, listEventos, supabaseConfigured, updateEvento } from '@/lib/supabase';
import { isManagerSession } from '@/lib/store';
import { eur, Notice, ViewHeader } from '@/views/ui';
import { EuroChart } from '@/views/EuroChart';
import { PinDialog } from '@/views/PinDialog';

const emptyIngreso = (): IncomeLine => ({
  concepto: '',
  categoria: '',
  paxAdultos: 0,
  pvpAdulto: 0,
  paxNinos: 0,
  pvpNino: 0,
  iva: null,
});

const ESTADO_TEXTO: Record<EventoPreview['estado'], string> = {
  '': 'Sin datos',
  'sin-ingresos': 'Ingresos sin importe',
  'falta-tipo': 'Elige el tipo de servicio',
  'en-objetivo': 'En objetivo',
  ajustado: 'Ajustado (ámbar)',
  bajo: 'Bajo objetivo',
};

/**
 * Datos del evento (solo manager): cabecera, ingresos, personal, varios y
 * vista previa del semáforo. Los supervisores solo tocan comida/bebida.
 */
export function ManagerEventView() {
  const { gid = '', eid = '' } = useParams();
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [evento, setEvento] = useState<EventoDraft | null>(null);
  const [isManager, setIsManager] = useState(() => isManagerSession());
  const [pinOpen, setPinOpen] = useState(false);

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [fecha, setFecha] = useState('');
  const [duracion, setDuracion] = useState(0);
  const [mesas, setMesas] = useState(0);
  const [ingresos, setIngresos] = useState<IncomeLine[]>([]);
  const [personal, setPersonal] = useState<PersonalDraft>({
    extraSala: 0,
    internoSala: 0,
    extraCocina: 0,
    internoCocina: 0,
  });
  const [varios, setVarios] = useState<VariosLine[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    loadedRef.current = false;
    if (!supabaseConfigured) return;
    let alive = true;
    getGrupo(gid).then((g) => alive && setGrupo(g));
    listEventos(gid)
      .then((evs) => {
        if (!alive) return;
        const ev = evs.find((e) => e.id === eid);
        if (!ev) return;
        setEvento(ev);
        setNombre(ev.nombre);
        setTipo(ev.tipo);
        setFecha(ev.fecha);
        setDuracion(ev.duracion);
        setMesas(ev.mesas);
        setIngresos(ev.ingresos.map((l) => ({ ...l })));
        setPersonal({ ...ev.personal });
        setVarios(ev.varios.map((v) => ({ ...v })));
        // Autoguardado: a partir de aquí cada cambio se persiste solo.
        loadedRef.current = true;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [gid, eid]);

  const preview = useMemo<EventoPreview>(
    () =>
      previewEvento({
        id: eid,
        grupoId: gid,
        orden: evento?.orden ?? 1,
        nombre,
        tipo,
        fecha,
        duracion,
        mesas,
        ingresos,
        comida: evento?.comida ?? [],
        bebida: evento?.bebida ?? [],
        personal,
        varios,
      }),
    [eid, gid, evento, nombre, tipo, fecha, duracion, mesas, ingresos, personal, varios],
  );

  const persist = async () => {
    if (!evento) return;
    setSaving(true);
    setSaveState('saving');
    setError(null);
    try {
      const limpios = ingresos.filter(
        (l) => l.concepto.trim() || l.paxAdultos * l.pvpAdulto + l.paxNinos * l.pvpNino > 0,
      );
      await updateEvento(evento.id, {
        nombre,
        tipo,
        fecha,
        duracion,
        mesas,
        ingresos: limpios,
        personal,
        varios,
      });
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  // Autoguardado: cualquier cambio se guarda solo (800 ms después de la
  // última pulsación) para no perder datos.
  useEffect(() => {
    if (!loadedRef.current || !evento) return;
    const t = setTimeout(persist, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre, tipo, fecha, duracion, mesas, ingresos, personal, varios]);

  const num = (
    v: string,
  ): number => (v === '' ? 0 : Math.max(0, Number(v) || 0));

  const semaforo =
    preview.estado === 'en-objetivo'
      ? 'bg-primary text-primary-foreground'
      : preview.estado === 'ajustado'
        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
        : 'bg-destructive/15 text-destructive border border-destructive/50';

  return (
    <div className="min-h-dvh">
      <ViewHeader
        title={nombre || 'Evento'}
        subtitle={grupo ? `${grupo.nombre}${grupo.os ? ` · OS ${grupo.os}` : ''}` : undefined}
        right={
          <>
            {isManager && (
              <span
                role="status"
                className={`h-9 px-3 inline-flex items-center font-data text-[10px] uppercase tracking-wide ${
                  saveState === 'saving'
                    ? 'text-muted-foreground'
                    : saveState === 'saved'
                      ? 'text-primary'
                      : saveState === 'error'
                        ? 'text-destructive'
                        : 'text-muted-foreground/50'
                }`}
              >
                {saving
                  ? 'Guardando…'
                  : saveState === 'saved'
                    ? '✓ Guardado'
                    : saveState === 'error'
                      ? 'Error al guardar'
                      : 'Autoguardado'}
              </span>
            )}
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

      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
        {!supabaseConfigured && (
          <Notice msg="Supabase no configurado: los cambios no se guardarán." />
        )}
        {error && <Notice msg={error} />}

        {!isManager ? (
          <section className="border border-border p-6 text-center flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Los datos del evento los rellena el manager. Los supervisores
              solo introducen consumiciones de comida y bebida.
            </p>
            <button
              onClick={() => setPinOpen(true)}
              className="h-12 bg-primary text-primary-foreground font-data text-xs uppercase tracking-wide font-bold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Soy manager — introducir PIN
            </button>
          </section>
        ) : (
          <>
            <section aria-label="Cabecera del evento" className="border border-border p-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                  Nombre del evento
                </span>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={`Evento ${evento?.orden ?? 1}`}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                  Tipo de servicio (define el objetivo de margen)
                </span>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— elegir —</option>
                  {TIPOS_SERVICIO.map((t) => (
                    <option key={t.short} value={t.short}>
                      {t.short} (objetivo {Math.round(t.objetivo * 100)} %)
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                    Fecha
                  </span>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                    Duración (h)
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={duracion || ''}
                    onChange={(e) => setDuracion(num(e.target.value))}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                    Nº mesas
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={mesas || ''}
                    onChange={(e) => setMesas(num(e.target.value))}
                    className={inputCls}
                  />
                </label>
              </div>
            </section>

            <section aria-label="Ingresos" className="border border-border">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="font-data text-xs uppercase tracking-widest text-muted-foreground">
                  Ingresos ({ingresos.length}/{MAX_INGRESOS})
                </h2>
                {ingresos.length < MAX_INGRESOS && (
                  <button
                    onClick={() => setIngresos((ls) => [...ls, emptyIngreso()])}
                    className="font-data text-xs uppercase tracking-wide text-primary hover:underline cursor-pointer"
                  >
                    + Añadir línea
                  </button>
                )}
              </div>
              <ul className="divide-y divide-border">
                {ingresos.map((l, i) => (
                  <li key={i} className="p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={l.concepto}
                        onChange={(e) =>
                          setIngresos((ls) =>
                            ls.map((x, j) => (j === i ? { ...x, concepto: e.target.value } : x)),
                          )
                        }
                        placeholder="Concepto (menú, barra libre…)"
                        className="flex-1 min-w-0 h-10 px-3 bg-background border border-input font-data text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <select
                        value={l.categoria}
                        onChange={(e) =>
                          setIngresos((ls) =>
                            ls.map((x, j) =>
                              j === i ? { ...x, categoria: e.target.value as CategoriaIngreso | '' } : x,
                            ),
                          )
                        }
                        className="h-10 px-2 bg-background border border-input font-data text-xs uppercase tracking-wide"
                      >
                        <option value="">Cat.</option>
                        <option value="Comida">Comida</option>
                        <option value="Bebida">Bebida</option>
                        <option value="Otros">Otros</option>
                      </select>
                      <button
                        onClick={() => setIngresos((ls) => ls.filter((_, j) => j !== i))}
                        aria-label="Quitar línea"
                        className="h-10 w-10 shrink-0 font-data text-xs text-muted-foreground hover:text-destructive border border-border cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="font-data text-[10px] uppercase text-muted-foreground">Pax ad.</span>
                        <input
                          type="number" min={0} inputMode="numeric"
                          value={l.paxAdultos || ''}
                          onChange={(e) => setIngresos((ls) => ls.map((x, j) => j === i ? { ...x, paxAdultos: num(e.target.value) } : x))}
                          className={miniCls}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="font-data text-[10px] uppercase text-muted-foreground">PVP ad. €</span>
                        <input
                          type="number" min={0} step="0.01" inputMode="decimal"
                          value={l.pvpAdulto || ''}
                          onChange={(e) => setIngresos((ls) => ls.map((x, j) => j === i ? { ...x, pvpAdulto: num(e.target.value) } : x))}
                          className={miniCls}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="font-data text-[10px] uppercase text-muted-foreground">Pax niños</span>
                        <input
                          type="number" min={0} inputMode="numeric"
                          value={l.paxNinos || ''}
                          onChange={(e) => setIngresos((ls) => ls.map((x, j) => j === i ? { ...x, paxNinos: num(e.target.value) } : x))}
                          className={miniCls}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="font-data text-[10px] uppercase text-muted-foreground">PVP niños €</span>
                        <input
                          type="number" min={0} step="0.01" inputMode="decimal"
                          value={l.pvpNino || ''}
                          onChange={(e) => setIngresos((ls) => ls.map((x, j) => j === i ? { ...x, pvpNino: num(e.target.value) } : x))}
                          className={miniCls}
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-data text-[10px] uppercase text-muted-foreground">IVA</span>
                      {([null, 0.21, 0] as const).map((v) => (
                        <label key={String(v)} className="inline-flex items-center gap-1.5 font-data text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="radio"
                            name={`iva-${i}`}
                            checked={l.iva === v}
                            onChange={() => setIngresos((ls) => ls.map((x, j) => j === i ? { ...x, iva: v } : x))}
                            className="accent-[hsl(137,100%,55%)]"
                          />
                          {v === null ? '10 % (def.)' : v === 0.21 ? '21 %' : '0 %'}
                        </label>
                      ))}
                      <span className="ml-auto font-data text-sm">
                        {eur(l.paxAdultos * l.pvpAdulto + l.paxNinos * l.pvpNino)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="Personal" className="border border-border p-4 flex flex-col gap-3">
              <h2 className="font-data text-xs uppercase tracking-widest text-muted-foreground">
                Personal (horas)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    ['extraSala', 'Horas extra Sala'],
                    ['internoSala', 'Personal interno - Servicio de Sala'],
                    ['extraCocina', 'Horas extra Cocina'],
                    ['internoCocina', 'Personal interno - Cocina'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="font-data text-[10px] uppercase text-muted-foreground">
                      {label}
                    </span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={personal[key] || ''}
                      onChange={(e) =>
                        setPersonal((p) => ({ ...p, [key]: num(e.target.value) }))
                      }
                      className={miniCls}
                    />
                  </label>
                ))}
              </div>
              <p className="font-data text-xs text-muted-foreground">
                Tarifas de la plantilla: extra 33,00 €/h · interno 21,12 €/h.
              </p>
            </section>

            <section aria-label="Costes varios" className="border border-border">
              <h2 className="px-4 py-3 border-b border-border font-data text-xs uppercase tracking-widest text-muted-foreground">
                Costes varios
              </h2>
              <ul className="divide-y divide-border">
                {VARIOS_CONCEPTOS.map((concepto, i) => {
                  const v = varios[i] ?? { cantidad: 0, costeUnitario: 0 };
                  return (
                    <li key={concepto} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="flex-1 text-sm">{concepto}</span>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={v.cantidad || ''}
                        placeholder="cant."
                        onChange={(e) =>
                          setVarios((vs) => {
                            const next = [...vs];
                            while (next.length <= i) next.push({ cantidad: 0, costeUnitario: 0 });
                            next[i] = { ...next[i], cantidad: num(e.target.value) };
                            return next;
                          })
                        }
                        className={miniCls + ' w-16 text-center'}
                      />
                      <span className="font-data text-xs text-muted-foreground">×</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={v.costeUnitario || ''}
                        placeholder="€/ud"
                        onChange={(e) =>
                          setVarios((vs) => {
                            const next = [...vs];
                            while (next.length <= i) next.push({ cantidad: 0, costeUnitario: 0 });
                            next[i] = { ...next[i], costeUnitario: num(e.target.value) };
                            return next;
                          })
                        }
                        className={miniCls + ' w-20'}
                      />
                      <span className="font-data text-sm w-20 text-right">
                        {v.cantidad * v.costeUnitario > 0 ? eur(v.cantidad * v.costeUnitario) : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-label="Vista previa" className="border border-border">
              <h2 className="px-4 py-3 border-b border-border font-data text-xs uppercase tracking-widest text-muted-foreground">
                Vista previa del resultado
              </h2>
              <dl className="divide-y divide-border">
                <Row label="Facturación bruta" value={eur(preview.bruta)} />
                <Row label={`Neta (IVA ${eur(preview.iva)})`} value={eur(preview.neta)} />
                <Row label="Comida + bebida" value={eur(preview.costeComida + preview.costeBebida)} />
                <Row label="Personal" value={eur(preview.costePersonal)} />
                <Row label="Varios" value={eur(preview.costeVarios)} />
                <Row label="Beneficio" value={eur(preview.beneficio)} strong />
              </dl>
              <EuroChart
                slices={euroSlices({
                  neta: preview.neta,
                  costeComida: preview.costeComida,
                  costeBebida: preview.costeBebida,
                  costePersonal: preview.costePersonal,
                  costeVarios: preview.costeVarios,
                })}
                neta={preview.neta}
              />
              <div className={`px-4 py-3 flex items-center justify-between ${semaforo}`}>
                <span className="font-data text-xs uppercase tracking-wide font-bold">
                  {ESTADO_TEXTO[preview.estado]}
                </span>
                <span className="font-data text-sm">
                  margen {(preview.margen * 100).toFixed(1)} % · objetivo{' '}
                  {(preview.objetivo * 100).toFixed(0)} %
                </span>
              </div>
            </section>
          </>
        )}
      </main>

      <PinDialog
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        onSuccess={() => {
          setIsManager(true);
          setPinOpen(false);
        }}
      />
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-baseline px-4 py-2.5 ${strong ? 'bg-primary text-primary-foreground' : ''}`}
    >
      <dt className="text-sm">{label}</dt>
      <dd className={`font-data text-sm ${strong ? 'font-bold' : ''}`}>{value}</dd>
    </div>
  );
}

const inputCls =
  'w-full h-11 px-3 bg-card border border-input font-data text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'placeholder:text-muted-foreground';

const miniCls =
  'h-10 px-2 bg-background border border-input font-data text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
