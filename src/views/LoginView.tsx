import { useState } from 'react';
import { LogIn } from 'lucide-react';
import {
  MANAGER_CODE,
  SUPERVISOR_CODE,
  startSession,
} from '@/lib/store';

const LOGO_KLM =
  'data:image/png;base64,' +
  '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';

/**
 * Pantalla de acceso: los supervisores entran con su nombre y el código
 * que les facilita el manager (0000); el manager entra solo con su código
 * (4444). La sesión dura hasta cerrar la pestaña o pulsar «Salir».
 */
export function LoginView({ onLogin }: { onLogin: () => void }) {
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const entrar = () => {
    const code = codigo.trim();
    if (code === MANAGER_CODE) {
      startSession({ role: 'manager', name: 'Manager' });
      onLogin();
      return;
    }
    if (code === SUPERVISOR_CODE) {
      const name = nombre.trim();
      if (!name) {
        setError('Escribe tu nombre: así se sabrá quién ha registrado cada cosa.');
        return;
      }
      startSession({ role: 'supervisor', name });
      onLogin();
      return;
    }
    setError('Código incorrecto. Inténtalo de nuevo.');
  };

  const inputCls =
    'w-full h-12 px-3 bg-card border border-input font-data text-sm ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <main className="w-full max-w-sm border border-border bg-card/50 p-6 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-full bg-white rounded-xl px-6 py-4 flex items-center justify-center">
            <img
              src={LOGO_KLM}
              alt="Kimpton Los Monteros Marbella"
              className="w-full max-w-[260px] h-auto"
            />
          </div>
          <div className="text-center">
            <h1 className="font-bold tracking-tight uppercase text-xl">
              Consumiciones
            </h1>
            <p className="font-data text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Control de consumiciones de eventos
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
            Tu nombre (supervisores)
          </span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && entrar()}
            placeholder="Nombre y apellido"
            autoComplete="name"
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
            Código de acceso
          </span>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && entrar()}
            placeholder="••••"
            inputMode="numeric"
            autoComplete="off"
            className={inputCls + ' text-center text-lg tracking-[0.5em]'}
          />
        </label>

        {error && (
          <p className="border border-destructive/60 bg-destructive/10 px-3 py-2 font-data text-sm">
            {error}
          </p>
        )}

        <button
          onClick={entrar}
          className="h-12 bg-primary text-primary-foreground font-data text-xs uppercase tracking-wide font-bold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogIn className="h-4 w-4" /> Entrar
        </button>

        <p className="font-data text-[10px] uppercase tracking-wide text-muted-foreground text-center">
          Los supervisores entran con nombre y código; el manager solo con
          su código. La sesión se cierra al salir.
        </p>
      </main>
    </div>
  );
}