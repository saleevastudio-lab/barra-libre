import { useState } from 'react';
import type { HistoryEntry } from '@/lib/types';
import { Trash2 } from 'lucide-react';

export function HistorySection({
  history,
  onClear,
}: {
  history: HistoryEntry[];
  onClear: () => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);

  if (history.length === 0) return null;

  return (
    <section aria-label="Historial de envíos">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-data text-xs uppercase tracking-widest text-muted-foreground">
          Historial de envíos
        </h2>
        {confirmClear ? (
          <span className="flex items-center gap-2">
            <button
              onClick={onClear}
              className="font-data text-xs uppercase text-destructive hover:underline cursor-pointer"
            >
              Confirmar borrado
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="font-data text-xs uppercase text-muted-foreground hover:underline cursor-pointer"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-1 font-data text-xs uppercase text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            <Trash2 className="h-3 w-3" /> Vaciar
          </button>
        )}
      </div>

      <ul className="border border-border divide-y divide-border">
        {history.map((h) => (
          <li key={h.id} className="px-4 py-3 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm truncate">
                {h.event.os || 'Sin Nº OS'} — {h.event.grupo || '—'}
              </div>
              <div className="font-data text-xs text-muted-foreground uppercase">
                {new Date(h.sentAt).toLocaleString('es-ES')} ·{' '}
                {h.lines.length} art. · {h.event.comensales} comens.
              </div>
            </div>
            <div className="font-data text-sm font-bold shrink-0">
              {h.totalCoste.toLocaleString('es-ES', {
                style: 'currency',
                currency: 'EUR',
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
