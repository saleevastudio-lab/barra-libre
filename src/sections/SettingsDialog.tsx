import { useEffect, useState } from 'react';
import type { TelegramSettings } from '@/lib/types';
import { X } from 'lucide-react';

export function SettingsDialog({
  open,
  onClose,
  settings,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  settings: TelegramSettings;
  onSave: (s: TelegramSettings) => void;
}) {
  const [token, setToken] = useState(settings.botToken);
  const [chatId, setChatId] = useState(settings.chatId);
  const [managerUrl, setManagerUrl] = useState(settings.managerUrl ?? '');

  useEffect(() => {
    if (open) {
      setToken(settings.botToken);
      setChatId(settings.chatId);
      setManagerUrl(settings.managerUrl ?? '');
    }
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configuración de Telegram"
        className="absolute inset-x-0 bottom-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:w-[480px] bg-popover border border-border max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-border">
          <h2 className="font-data text-xs uppercase tracking-widest">
            Bot de Telegram
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="h-9 w-9 inline-flex items-center justify-center border border-border hover:bg-foreground hover:text-background transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Crea un bot con <b className="text-foreground">@BotFather</b>{' '}
            (comando <span className="font-data">/newbot</span>) y pega el token
            aquí. El chat ID es el número del chat del manager (puedes
            obtenerlo escribiendo a{' '}
            <span className="font-data">@userinfobot</span> o mirando{' '}
            <span className="font-data">getUpdates</span>).
          </p>

          <label className="flex flex-col gap-1">
            <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
              Token del bot
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456:ABC-DEF…"
              autoComplete="off"
              className={inputCls}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
              Chat ID del manager
            </span>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-100123456789"
              autoComplete="off"
              className={inputCls}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
              URL de la web del manager (opcional)
            </span>
            <input
              type="text"
              value={managerUrl}
              onChange={(e) => setManagerUrl(e.target.value)}
              placeholder="https://… (vacío = esta misma app)"
              autoComplete="off"
              className={inputCls}
            />
            <span className="font-data text-xs text-muted-foreground leading-relaxed">
              Dirección donde el botón del mensaje de Telegram abrirá la vista
              del manager con los datos. Déjala vacía para usar esta misma web.
            </span>
          </label>

          <button
            onClick={() => {
              onSave({
                botToken: token,
                chatId: chatId,
                managerUrl: managerUrl.trim(),
              });
              onClose();
            }}
            className="h-12 bg-primary text-primary-foreground font-data text-xs uppercase tracking-wide font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Guardar configuración
          </button>

          <p className="font-data text-xs text-muted-foreground leading-relaxed">
            El token se guarda solo en este dispositivo (navegador) y se envía
            directamente a la API de Telegram, sin pasar por ningún servidor.
          </p>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full h-11 px-3 bg-card border border-input font-data text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'placeholder:text-muted-foreground';
