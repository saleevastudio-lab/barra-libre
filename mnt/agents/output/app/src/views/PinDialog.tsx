import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getPinHash, setPin, verifyPin } from '@/lib/supabase';

/**
 * Diálogo de acceso al panel del manager.
 * - Primera vez (sin PIN guardado): pide crear uno.
 * - Después: pide el PIN y, si cuadra, marca la sesión de manager.
 */
export function PinDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstUse, setFirstUse] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPinValue('');
    setConfirm('');
    setError(null);
    setBusy(true);
    getPinHash()
      .then((h) => setFirstUse(!h))
      .catch(() => setFirstUse(true))
      .finally(() => setBusy(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    if (!/^\d{4,8}$/.test(pin)) {
      setError('El PIN debe tener entre 4 y 8 dígitos.');
      return;
    }
    setBusy(true);
    try {
      if (firstUse) {
        if (pin !== confirm) {
          setError('Los PIN no coinciden.');
          return;
        }
        await setPin(pin);
        onSuccess();
      } else {
        const ok = await verifyPin(pin);
        if (ok) onSuccess();
        else setError('PIN incorrecto.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Acceso manager"
        className="absolute inset-x-0 bottom-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:w-[400px] bg-popover border border-border max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-border">
          <h2 className="font-data text-xs uppercase tracking-widest">
            {firstUse ? 'Crear PIN de manager' : 'Acceso manager'}
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
          {firstUse && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Es la primera vez: crea un PIN numérico para proteger el panel
              del manager (datos económicos y generación del Excel).
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
              {firstUse ? 'PIN nuevo' : 'PIN'}
            </span>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && !firstUse && submit()}
              placeholder="····"
              autoComplete="off"
              className={inputCls}
            />
          </label>
          {firstUse && (
            <label className="flex flex-col gap-1">
              <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
                Repetir PIN
              </span>
              <input
                type="password"
                inputMode="numeric"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="····"
                autoComplete="off"
                className={inputCls}
              />
            </label>
          )}
          {error && (
            <p className="font-data text-xs text-destructive">{error}</p>
          )}
          <button
            onClick={submit}
            disabled={busy}
            className="h-12 bg-primary text-primary-foreground font-data text-xs uppercase tracking-wide font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer disabled:cursor-default"
          >
            {busy ? 'Comprobando…' : firstUse ? 'Guardar PIN' : 'Entrar'}
          </button>
          <p className="font-data text-xs text-muted-foreground leading-relaxed">
            El PIN es un disuasorio ante ediciones accidentales: con RLS
            abierta, cualquiera con la URL podría modificar datos directamente.
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
