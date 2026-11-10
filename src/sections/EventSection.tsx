import type { EventData } from '@/lib/types';
import { SERVICE_TYPE } from '@/lib/catalog';

export function EventSection({
  event,
  onChange,
}: {
  event: EventData;
  onChange: (e: EventData) => void;
}) {
  const set = (patch: Partial<EventData>) => onChange({ ...event, ...patch });

  return (
    <section aria-label="Datos del evento">
      <h2 className="font-data text-xs uppercase tracking-widest text-muted-foreground mb-3">
        1 · Datos del evento
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha">
          <input
            type="date"
            value={event.fecha}
            onChange={(e) => set({ fecha: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Nº OS">
          <input
            type="text"
            value={event.os}
            onChange={(e) => set({ os: e.target.value })}
            placeholder="BQ-0000"
            className={inputCls}
          />
        </Field>
        <Field label="Tipo de servicio">
          <div
            aria-label="Tipo de servicio"
            className={`${inputCls} flex items-center text-muted-foreground uppercase`}
          >
            {SERVICE_TYPE}
          </div>
        </Field>
        <Field label="Grupo / nombre del evento">
          <input
            type="text"
            value={event.grupo}
            onChange={(e) => set({ grupo: e.target.value })}
            placeholder="BCG"
            className={inputCls}
          />
        </Field>
        <Field label="Comensales adultos">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={event.comensales || ''}
            onChange={(e) => set({ comensales: Number(e.target.value) || 0 })}
            className={inputCls}
          />
        </Field>
        <Field label="P.V.P. adulto (IVA incl.)">
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={event.pvp || ''}
            onChange={(e) => set({ pvp: Number(e.target.value) || 0 })}
            placeholder="0,00"
            className={inputCls}
          />
        </Field>
        <Field label="Niños">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={event.ninos || ''}
            onChange={(e) => set({ ninos: Number(e.target.value) || 0 })}
            className={inputCls}
          />
        </Field>
        <Field label="P.V.P. niño (IVA incl.)">
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={event.pvpNinos || ''}
            onChange={(e) => set({ pvpNinos: Number(e.target.value) || 0 })}
            placeholder="0,00"
            className={inputCls}
          />
        </Field>
      </div>
    </section>
  );
}

const inputCls =
  'w-full h-11 px-3 bg-card border border-input font-data text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'placeholder:text-muted-foreground';

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
