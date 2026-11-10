import { useState } from 'react';
import type { EventData } from '@/lib/types';

export function CostsSection({
  event,
  onChange,
}: {
  event: EventData;
  onChange: (e: EventData) => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<EventData>) => onChange({ ...event, ...patch });

  const costeSocial =
    event.horasExtraSala * event.rateExtra +
    event.horasPersonalSala * event.rateInterno +
    event.horasExtraCocina * event.rateExtra +
    event.horasPersonalCocina * event.rateInterno;

  return (
    <section aria-label="Costes sociales y varios">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between mb-3 cursor-pointer group"
      >
        <h2 className="font-data text-xs uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          3 · Costes sociales y varios
        </h2>
        <span className="font-data text-xs text-muted-foreground uppercase">
          {open ? 'cerrar −' : `coste social ${costeSocial.toFixed(2).replace('.', ',')} € +`}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3">
          <fieldset className="border border-border p-3 grid grid-cols-2 gap-3">
            <legend className="font-data text-xs uppercase tracking-wide text-muted-foreground px-1">
              Personal de sala
            </legend>
            <Field label="Horas extra">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={event.horasExtraSala || ''}
                onChange={(e) =>
                  set({ horasExtraSala: Number(e.target.value) || 0 })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Horas personal interno">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={event.horasPersonalSala || ''}
                onChange={(e) =>
                  set({ horasPersonalSala: Number(e.target.value) || 0 })
                }
                className={inputCls}
              />
            </Field>
          </fieldset>

          <fieldset className="border border-border p-3 grid grid-cols-2 gap-3">
            <legend className="font-data text-xs uppercase tracking-wide text-muted-foreground px-1">
              Personal de cocina
            </legend>
            <Field label="Horas extra">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={event.horasExtraCocina || ''}
                onChange={(e) =>
                  set({ horasExtraCocina: Number(e.target.value) || 0 })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Horas personal interno">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={event.horasPersonalCocina || ''}
                onChange={(e) =>
                  set({ horasPersonalCocina: Number(e.target.value) || 0 })
                }
                className={inputCls}
              />
            </Field>
          </fieldset>

          <fieldset className="border border-border p-3 grid grid-cols-2 gap-3">
            <legend className="font-data text-xs uppercase tracking-wide text-muted-foreground px-1">
              Tarifas (€/h)
            </legend>
            <Field label="Hora extra (25 × 1,32)">
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={event.rateExtra || ''}
                onChange={(e) => set({ rateExtra: Number(e.target.value) || 0 })}
                className={inputCls}
              />
            </Field>
            <Field label="Personal interno (16 × 1,32)">
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={event.rateInterno || ''}
                onChange={(e) =>
                  set({ rateInterno: Number(e.target.value) || 0 })
                }
                className={inputCls}
              />
            </Field>
          </fieldset>

          <fieldset className="border border-border p-3 grid grid-cols-2 gap-3">
            <legend className="font-data text-xs uppercase tracking-wide text-muted-foreground px-1">
              Costes varios (unid × €/unid)
            </legend>
            {VARIOS_LINES.map((line) => (
              <VariosLine
                key={line.undKey}
                label={line.label}
                und={event[line.undKey] as number}
                coste={event[line.costeKey] as number}
                onChange={(und, coste) =>
                  set({ [line.undKey]: und, [line.costeKey]: coste })
                }
              />
            ))}
            <Field label="Observaciones" full>
              <textarea
                value={event.observaciones}
                onChange={(e) => set({ observaciones: e.target.value })}
                rows={2}
                placeholder="Incidencias, roturas, notas para el manager…"
                className={`${inputCls} h-auto py-2 resize-y`}
              />
            </Field>
          </fieldset>
        </div>
      )}
    </section>
  );
}

const inputCls =
  'w-full h-11 px-3 bg-card border border-input font-data text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'placeholder:text-muted-foreground';

// Las 7 líneas de costes varios de Análisis (filas 46–52), en orden
const VARIOS_LINES: {
  label: string;
  undKey: 'lavanderiaUnd' | 'decoracionMesas' | 'climatizacionHoras' |
    'iluminacionHoras' | 'imprentaPersonas' | 'dotacionUnd' | 'auxiliaresUnd';
  costeKey: 'lavanderiaCoste' | 'decoracionCoste' | 'climatizacionCoste' |
    'iluminacionCoste' | 'imprentaCoste' | 'dotacionCoste' | 'auxiliaresCoste';
}[] = [
  { label: 'Lavandería (pers.)', undKey: 'lavanderiaUnd', costeKey: 'lavanderiaCoste' },
  { label: 'Decoración mesas', undKey: 'decoracionMesas', costeKey: 'decoracionCoste' },
  { label: 'Climatización (h)', undKey: 'climatizacionHoras', costeKey: 'climatizacionCoste' },
  { label: 'Iluminación (h)', undKey: 'iluminacionHoras', costeKey: 'iluminacionCoste' },
  { label: 'Imprenta (pers.)', undKey: 'imprentaPersonas', costeKey: 'imprentaCoste' },
  { label: 'Dotación / roturas', undKey: 'dotacionUnd', costeKey: 'dotacionCoste' },
  { label: 'Artículos auxiliares', undKey: 'auxiliaresUnd', costeKey: 'auxiliaresCoste' },
];

function VariosLine({
  label,
  und,
  coste,
  onChange,
}: {
  label: string;
  und: number;
  coste: number;
  onChange: (und: number, coste: number) => void;
}) {
  return (
    <div className="col-span-2 grid grid-cols-[1fr_1fr] gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <span className="col-span-2 -mb-2 font-data text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        aria-label={`${label} unidades`}
        value={und || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0, coste)}
        placeholder="uds"
        className={inputCls}
      />
      <input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        aria-label={`${label} coste unitario`}
        value={coste || ''}
        onChange={(e) => onChange(und, Number(e.target.value) || 0)}
        placeholder="€/ud"
        className={inputCls}
      />
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? 'col-span-2' : ''}`}>
      <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
