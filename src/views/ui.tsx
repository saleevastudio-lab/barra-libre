import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { getSession } from '@/lib/store';

/** Usuario actual + botón de salir, común a todas las pantallas. */
function UserChip() {
  const u = getSession();
  if (!u) return null;
  return (
    <>
      <span className="hidden md:inline font-data text-[10px] uppercase tracking-wide text-muted-foreground max-w-40 truncate">
        {u.name}
        {u.role === 'manager' ? ' · manager' : ''}
      </span>
      <button
        onClick={() => {
          sessionStorage.removeItem('consumiciones.manager.v1');
          window.location.hash = '#/';
          window.location.reload();
        }}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="h-8 px-2 inline-flex items-center gap-1 border border-border text-muted-foreground font-data text-[10px] uppercase tracking-wide hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </>
  );
}

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
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <UserChip />
        </div>
      </div>
    </header>
  );
}