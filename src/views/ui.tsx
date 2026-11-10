import type { ReactNode } from 'react';
import type { SummaryNumbers } from '@/lib/telegram';

export const eur = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

export function Notice({ msg }: { msg: string }) {
  return (
    <div
      role="status"
      className="border border-primary/60 bg-primary/10 px-4 py-3 font-data text-sm"
    >
      {msg}
    </div>
  );
}

export function ViewHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="font-bold tracking-tight uppercase truncate">{title}</h1>
          {subtitle && (
            <span className="font-data text-xs text-muted-foreground uppercase hidden sm:inline">
              {subtitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">{right}</div>
      </div>
    </header>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-baseline px-4 py-2.5">
      <dt className="text-sm">{label}</dt>
      <dd className="font-data text-sm">{eur(value)}</dd>
    </div>
  );
}

export function SummarySection({ summary }: { summary: SummaryNumbers }) {
  return (
    <section aria-label="Resumen económico">
      <h2 className="font-data text-xs uppercase tracking-widest text-muted-foreground mb-3">
        Resumen
      </h2>
      <dl className="border border-border divide-y divide-border">
        <SummaryRow label="Coste bebida" value={summary.totalCoste} />
        <SummaryRow label="Facturación bruta" value={summary.facturacionBruta} />
        <SummaryRow
          label="Facturación neta (sin IVA)"
          value={summary.facturacionNeta}
        />
        <div className="flex justify-between items-baseline px-4 py-2.5">
          <dt className="text-sm">% coste bebida / venta neta</dt>
          <dd className="font-data text-sm">
            {(summary.pctCoste * 100).toFixed(2)} %
          </dd>
        </div>
        <SummaryRow label="Coste social" value={summary.costeSocial} />
        <SummaryRow label="Costes varios" value={summary.costesVarios} />
        <div className="flex justify-between items-baseline px-4 py-2.5 bg-primary text-primary-foreground">
          <dt className="text-sm font-semibold uppercase">
            Beneficio operacional
          </dt>
          <dd className="font-data font-bold">{eur(summary.beneficio)}</dd>
        </div>
      </dl>
    </section>
  );
}
