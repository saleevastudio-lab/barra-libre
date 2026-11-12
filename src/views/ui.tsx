import type { ReactNode } from 'react';

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
