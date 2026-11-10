import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CATEGORIES, SERVICE_TYPES, DEFAULT_EVENT } from '@/lib/catalog';
import type {
  Drink,
  EventData,
  HistoryEntry,
  OrderLine,
  TelegramSettings,
} from '@/lib/types';
import {
  loadEvent,
  saveEvent,
  loadLines,
  saveLines,
  loadSettings,
  saveSettings,
  loadHistory,
  pushHistory,
  clearHistory,
  loadDrinks,
  saveDrinks,
} from '@/lib/store';
import {
  buildSupervisorMessage,
  computeSummary,
  sendTelegram,
} from '@/lib/telegram';
import { appBaseUrl, encodeConsumption, managerUrlWithData } from '@/lib/share';
import { DrinksSection } from '@/sections/DrinksSection';
import { SettingsDialog } from '@/sections/SettingsDialog';
import { HistorySection } from '@/sections/HistorySection';
import { Notice, ViewHeader, eur } from '@/views/ui';
import { Send, Settings, Eraser } from 'lucide-react';

type CategoryFilter = 'all' | Drink['category'];

export function SupervisorView() {
  const [event, setEvent] = useState<EventData>(() => {
    const e = loadEvent();
    // La fecha siempre arranca en hoy: si la guardada es de un día pasado
    // (el navegador conserva el último evento), se actualiza al día actual.
    const today = new Date().toISOString().slice(0, 10);
    if (e.fecha && e.fecha < today) e.fecha = today;
    return e;
  });
  const [lines, setLines] = useState<OrderLine[]>(() => loadLines());
  const [drinks, setDrinks] = useState<Drink[]>(() => loadDrinks());
  const [settings, setSettings] = useState<TelegramSettings>(() =>
    loadSettings(),
  );
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => saveEvent(event), [event]);
  useEffect(() => saveLines(lines), [lines]);
  useEffect(() => saveDrinks(drinks), [drinks]);

  const summary = useMemo(
    () => computeSummary(event, lines, drinks),
    [event, lines, drinks],
  );
  const usedCount = lines.reduce((a, l) => a + (l.qty > 0 ? 1 : 0), 0);

  function flash(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }

  function setQty(drinkId: string, qty: number) {
    setLines((prev) => {
      const rest = prev.filter((l) => l.drinkId !== drinkId);
      return qty > 0 ? [...rest, { drinkId, qty }] : rest;
    });
  }

  function setCost(drinkId: string, unitCost: number) {
    setDrinks((prev) =>
      prev.map((d) => (d.id === drinkId ? { ...d, unitCost } : d)),
    );
  }

  /** Crea o actualiza un ítem; los cambios se guardan en el dispositivo. */
  function upsertDrink(drink: Drink) {
    setDrinks((prev) => {
      const i = prev.findIndex((d) => d.id === drink.id);
      if (i === -1) return [...prev, drink];
      const next = [...prev];
      next[i] = drink;
      return next;
    });
  }

  function removeDrink(drinkId: string) {
    setDrinks((prev) => prev.filter((d) => d.id !== drinkId));
    setLines((prev) => prev.filter((l) => l.drinkId !== drinkId));
  }

  /** Pone a cero el evento y las cantidades (catálogo y costes se conservan). */
  function handleClear() {
    const today = new Date().toISOString().slice(0, 10);
    setEvent({ ...DEFAULT_EVENT, fecha: today });
    setLines([]);
    setClearOpen(false);
    flash('Contenido limpiado: evento y cantidades a cero.');
  }

  async function handleSend() {
    if (!settings.botToken || !settings.chatId) {
      setSettingsOpen(true);
      flash('Primero configura el bot de Telegram (token y chat ID).');
      return;
    }
    if (!event.grupo.trim()) {
      flash('Escribe el nombre del grupo / evento antes de enviar.');
      return;
    }
    if (usedCount === 0) {
      flash('Añade al menos una bebida con consumo mayor que cero.');
      return;
    }
    setSending(true);
    try {
      const payload = encodeConsumption({
        grupo: event.grupo.trim(),
        fecha: event.fecha,
        tipoServicio: event.tipoServicio,
        lines,
        drinks,
      });
      const base = settings.managerUrl.trim() || appBaseUrl();
      const managerUrl = managerUrlWithData(base, payload);
      const message = buildSupervisorMessage(
        event.grupo,
        event.fecha,
        lines,
        drinks,
        event.tipoServicio,
      );
      await sendTelegram(settings, message, {
        text: 'Completar datos y generar Excel',
        url: managerUrl,
      });
      const entry: HistoryEntry = {
        id: `${Date.now()}`,
        sentAt: new Date().toISOString(),
        event: { ...event },
        lines: lines.filter((l) => l.qty > 0).map((l) => ({ ...l })),
        totalCoste: summary.totalCoste,
      };
      setHistory(pushHistory(entry));
      flash('Consumición enviada al manager por Telegram.');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Error al enviar por Telegram.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-32">
      <ViewHeader
        title="Consumiciones"
        subtitle="Supervisor · envío de consumición"
        right={
          <>
            <span className="font-data text-xs text-muted-foreground uppercase">
              {usedCount} art.
            </span>
            <button
              onClick={() => setClearOpen(true)}
              aria-label="Limpiar contenido del evento"
              className="h-9 w-9 inline-flex items-center justify-center border border-border hover:bg-foreground hover:text-background transition-colors cursor-pointer"
            >
              <Eraser className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Configuración de Telegram"
              className="h-9 w-9 inline-flex items-center justify-center border border-border hover:bg-foreground hover:text-background transition-colors cursor-pointer"
            >
              <Settings className="h-4 w-4" />
            </button>
          </>
        }
      />

      <main className="max-w-3xl mx-auto px-4 flex flex-col gap-8 pt-6">
        {notice && <Notice msg={notice} />}

        {/* El supervisor identifica el grupo / evento y el tipo de servicio */}
        <section aria-label="Grupo del evento">
          <h2 className="font-data text-xs uppercase tracking-widest text-muted-foreground mb-3">
            1 · Grupo / nombre del evento
          </h2>
          <input
            type="text"
            value={event.grupo}
            onChange={(e) => setEvent({ ...event, grupo: e.target.value })}
            placeholder="Ej. BCG"
            autoComplete="off"
            className="w-full h-12 px-3 bg-card border border-input font-data text-lg uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground placeholder:normal-case"
          />
          <label className="flex flex-col gap-1 mt-3">
            <span className="font-data text-xs uppercase tracking-wide text-muted-foreground">
              Tipo de servicio
            </span>
            <select
              value={event.tipoServicio}
              onChange={(e) => setEvent({ ...event, tipoServicio: e.target.value })}
              className="w-full h-12 px-3 bg-card border border-input font-data text-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SERVICE_TYPES.map((t) => (
                <option key={t.clave} value={t.label}>
                  {t.clave} · {t.label}
                </option>
              ))}
            </select>
          </label>
          <p className="font-data text-xs text-muted-foreground mt-2 uppercase">
            El manager completará el resto de datos (comensales, PVP, costes…)
          </p>
        </section>

        <DrinksSection
          drinks={drinks}
          lines={lines}
          filter={filter}
          onFilter={(f) => setFilter(f as CategoryFilter)}
          categories={CATEGORIES}
          onQty={setQty}
          onCost={setCost}
          onUpsert={upsertDrink}
          onDelete={removeDrink}
        />

        <HistorySection
          history={history}
          onClear={() => setHistory(clearHistory())}
        />
      </main>

      {/* Barra de acción inferior fija */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-background border-t border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-data text-xs uppercase text-muted-foreground">
              Coste bebida
            </div>
            <div className="font-data font-bold text-lg leading-none truncate">
              {eur(summary.totalCoste)}
            </div>
          </div>
          <Link
            to="/manager"
            className="h-12 px-3 inline-flex items-center border border-border font-data text-xs uppercase tracking-wide hover:bg-foreground hover:text-background transition-colors"
          >
            Manager
          </Link>
          <button
            onClick={handleSend}
            disabled={sending}
            className="h-12 px-4 sm:px-6 inline-flex items-center gap-2 bg-primary text-primary-foreground font-data text-xs uppercase tracking-wide font-bold hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40 cursor-pointer"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={(s) => {
          setSettings(s);
          saveSettings(s);
        }}
      />

      <ClearDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={handleClear}
      />
    </div>
  );
}

/** Confirma antes de limpiar el evento y las cantidades del supervisor. */
function ClearDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirmar limpieza"
        className="w-full max-w-sm border border-border bg-background p-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-data text-xs uppercase tracking-widest text-destructive">
          Limpiar contenido
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Se pondrán a cero todas las cantidades y se vaciarán los datos del
          evento (grupo, fecha y tipo de servicio). Los artículos y costes del
          catálogo se conservan.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onConfirm}
            className="h-10 px-4 bg-destructive text-destructive-foreground font-data text-xs uppercase tracking-wide font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Limpiar
          </button>
          <button
            onClick={onClose}
            className="h-10 px-4 border border-border font-data text-xs uppercase tracking-wide hover:bg-foreground hover:text-background transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
