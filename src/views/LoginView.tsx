import { useState } from 'react';
import { LogIn } from 'lucide-react';
import {
  MANAGER_CODE,
  SUPERVISOR_CODE,
  startSession,
} from '@/lib/store';

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
              src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAggAAACYCAYAAAB7huq0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAcSURBVHgB7cExAQAAAMKg9U9tCy8gAAAAAAAAAAAAAADgNSL0AAEH7JZmAAAAAElFTkSuQmCC"
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
