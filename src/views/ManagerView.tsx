import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CATEGORIES } from '@/lib/catalog';
import { DEFAULT_EVENT, normalizeTipo } from '@/lib/catalog';
import type { Drink, EventData, OrderLine } from '@/lib/types';
import { computeSummary } from '@/lib/telegram';
import { decodeConsumption } from '@/lib/share';
import { generateExcel, excelFileName } from '@/lib/excel';
import { EventSection } from '@/sections/EventSection';
import { DrinksSection } from '@/sections/DrinksSection';
import { CostsSection } from '@/sections/CostsSection';
import { Notice, SummarySection, ViewHeader, eur } from '@/views/ui';
import { ArrowLeft, FileSpreadsheet, TriangleAlert } from 'lucide-react';

type CategoryFilter = 'all' | Drink['category'];

export function ManagerView() {
  const [params] = useSearchParams();
  const payload = params.get('d');
  // El payload viaja en la URL: se decodifica en cada carga y la recarga
  // del enlace del botón de Telegram vuelve a precargar los datos.
  const shared = useMemo(() => (payload ? decodeConsumption(payload) : null), [
    payload,
  ]);

  const [event, setEvent] = useState<EventData>(() => ({
    ...DEFAULT_EVENT,
    ...(shared ? { grupo: shared.grupo, fecha: shared.fecha || DEFAULT_EVENT.fecha } : {}),
    ...(shared?.tipoServicio
      ? { tipoServicio: normalizeTipo(shared.tipoServicio) }
      : {}),
  }));
  const [lines, setLines] = useState<OrderLine[]>(() => shared?.lines ?? []);
  const [drinks, setDrinks] = useState<Drink[]>(() => shared?.drinks ?? []);
  const [filter, setFilter] = useState<CategoryFilter>('all');

  // Si la vista ya estaba montada y llega un payload nuevo (otro enlace del
  // botón abierto en la misma pestaña), se reaplica sobre el estado actual.
  useEffect(() => {
    if (!shared) return;
    setEvent((prev) => ({
      ...prev,
      grupo: shared.grupo,
      fecha: shared.fecha || prev.fecha,
      ...(shared.tipoServicio
        ? { tipoServicio: normalizeTipo(shared.tipoServicio) }
        : {}),
    }));
    setLines(shared.lines);
    setDrinks(shared.drinks);
  }, [shared]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function upsertDrink(drink: Drink) {
    setDrinks((prev) => {
      const i = prev.findIndex((d) => d.id === drink.id);
      if (i === -1) return [...prev, drink];
      const next = [...prev];
      next[i] = drink;
      return next;
    });
  }

  async function handleExcel() {
    setBusy(true);
    try {
      const blob = await generateExcel(event, lines, drinks);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = excelFileName(event);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash('Excel generado: ' + excelFileName(event));
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Error al generar el Excel.');
    } finally {
      setBusy(false);
    }
  }

  // Enlace sin datos (o corrupto): se pide abrirlo desde el botón del mensaje.
  if (!shared) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground">
        <ViewHeader
          title="Consumiciones"
          subtitle="Manager"
          right={
            <Link
              to="/"
              className="h-9 px-3 inline-flex items-center gap-2 border border-border font-data text-xs uppercase tracking-wide hover:bg-foreground hover:text-background transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Supervisor
            </Link>
          }
        />
        <main className="max-w-3xl mx-auto px-4 pt-6">
          <div
            role="alert"
            className="border border-destructive/60 bg-destructive/10 px-4 py-4 flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 font-data text-sm uppercase">
              <TriangleAlert className="h-4 w-4" />
              Sin datos de consumición
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Esta pantalla se rellena automáticamente al abrirla desde el
              botón del mensaje de Telegram que envía el supervisor. Si has
              llegado aquí escribiendo la dirección a mano, pide al supervisor
              que envíe la consumición o vuelve a la vista del supervisor.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-32">
      <ViewHeader
        title="Consumiciones"
        subtitle="Manager · cierre de evento"
        right={
          <>
            <span className="font-data text-xs text-muted-foreground uppercase">
              {usedCount} art.
            </span>
            <Link
              to="/"
              aria-label="Volver a la vista del supervisor"
              className="h-9 w-9 inline-flex items-center justify-center border border-border hover:bg-foreground hover:text-background transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <main className="max-w-3xl mx-auto px-4 flex flex-col gap-8 pt-6">
        {notice && <Notice msg={notice} />}

        <div className="border border-primary/40 bg-primary/5 px-4 py-3 font-data text-xs uppercase tracking-wide text-muted-foreground">
          Consumición precargada desde Telegram —{' '}
          <span className="text-foreground font-bold">
            {event.grupo || 'sin grupo'}
          </span>
          {event.fecha ? ` · ${event.fecha}` : ''}. Completa los datos del
          evento y genera el Excel.
        </div>

        <EventSection event={event} onChange={setEvent} />

        <DrinksSection
          drinks={drinks}
          lines={lines}
          filter={filter}
          onFilter={(f) => setFilter(f as CategoryFilter)}
          categories={CATEGORIES}
          onQty={setQty}
          onCost={setCost}
          onUpsert={upsertDrink}
        />

        <CostsSection event={event} onChange={setEvent} />

        <SummarySection summary={summary} />
      </main>

      {/* Barra de acción inferior fija */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-background border-t border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-data text-xs uppercase text-muted-foreground">
              Beneficio estimado
            </div>
            <div className="font-data font-bold text-lg leading-none truncate">
              {eur(summary.beneficio)}
            </div>
          </div>
          <button
            onClick={handleExcel}
            disabled={busy || usedCount === 0}
            className="h-12 px-4 sm:px-6 inline-flex items-center gap-2 bg-primary text-primary-foreground font-data text-xs uppercase tracking-wide font-bold hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {busy ? 'Generando…' : 'Generar Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
