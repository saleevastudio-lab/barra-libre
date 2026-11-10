import { useEffect } from 'react';
import type { Drink, EventData, OrderLine } from '@/lib/types';
import { buildTelegramMessage } from '@/lib/telegram';
import { X } from 'lucide-react';

export function ConfirmDialog({
  open,
  sending,
  onCancel,
  onConfirm,
  event,
  lines,
  drinks,
  missing,
}: {
  open: boolean;
  sending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  event: EventData;
  lines: OrderLine[];
  drinks: Drink[];
  missing: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const message = buildTelegramMessage(event, lines, drinks);

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Vista previa del envío a Telegram"
        className="absolute inset-x-0 bottom-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:w-[560px] bg-popover border border-border max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <h2 className="font-data text-xs uppercase tracking-widest">
            Vista previa — mensaje al manager
          </h2>
          <button
            onClick={onCancel}
            aria-label="Cerrar"
            className="h-9 w-9 inline-flex items-center justify-center border border-border hover:bg-foreground hover:text-background transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <pre className="flex-1 overflow-y-auto px-4 py-3 font-data text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
          {message.replace(/<[^>]+>/g, '')}
        </pre>

        {missing && (
          <p className="px-4 pb-2 font-data text-xs text-destructive uppercase">
            Aviso: faltan comensales, PVP o artículos — el mensaje se enviará
            igualmente.
          </p>
        )}

        <div className="flex gap-2 p-4 border-t border-border shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 h-12 border border-border font-data text-xs uppercase tracking-wide hover:bg-foreground hover:text-background transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={sending}
            className="flex-1 h-12 bg-primary text-primary-foreground font-data text-xs uppercase tracking-wide font-bold hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
          >
            {sending ? 'Enviando…' : 'Confirmar envío'}
          </button>
        </div>
      </div>
    </div>
  );
}
