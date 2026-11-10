import { useState } from 'react';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import type { CategoryId, Drink, OrderLine } from '@/lib/types';

interface Props {
  drinks: Drink[];
  lines: OrderLine[];
  filter: string;
  onFilter: (f: string) => void;
  categories: { id: string; label: string }[];
  onQty: (drinkId: string, qty: number) => void;
  onCost: (drinkId: string, unitCost: number) => void;
  /** Crea o actualiza un ítem (nombre, categoría, unidad de medida, coste). */
  onUpsert: (drink: Drink) => void;
  /** Elimina un ítem creado por el usuario. */
  onDelete?: (drinkId: string) => void;
}

export function DrinksSection({
  drinks,
  lines,
  filter,
  onFilter,
  categories,
  onQty,
  onCost,
  onUpsert,
  onDelete,
}: Props) {
  const [editingCost, setEditingCost] = useState<string | null>(null);
  // Ítem cuya cantidad se está escribiendo a teclado (toque sobre el número).
  const [editingQty, setEditingQty] = useState<string | null>(null);
  // null = ningún editor abierto; '__new__' = nuevo ítem; id = editar ese ítem
  const [editorFor, setEditorFor] = useState<string | null>(null);
  const qtyOf = (id: string) => lines.find((l) => l.drinkId === id)?.qty ?? 0;

  const visible =
    filter === 'all' ? drinks : drinks.filter((d) => d.category === filter);

  return (
    <section aria-label="Consumo de bebidas">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-data text-xs uppercase tracking-widest text-muted-foreground">
          2 · Consumo de bebidas
        </h2>
        <button
          onClick={() => setEditorFor(editorFor === '__new__' ? null : '__new__')}
          className="font-data text-xs uppercase tracking-wide text-primary border border-primary/50 px-2 py-1 hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
        >
          {editorFor === '__new__' ? 'cancelar' : '+ añadir ítem'}
        </button>
      </div>

      {editorFor === '__new__' && (
        <div className="mb-4">
          <DrinkEditor
            title="Nuevo ítem"
            onSave={(draft) => {
              onUpsert({ ...draft, id: `x${Date.now()}`, custom: true });
              setEditorFor(null);
            }}
            onCancel={() => setEditorFor(null)}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-1 mb-4" role="tablist" aria-label="Categorías">
        {[{ id: 'all', label: 'Todas' }, ...categories].map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={filter === c.id}
            onClick={() => onFilter(c.id)}
            className={`h-9 px-3 font-data text-xs uppercase tracking-wide border transition-colors cursor-pointer ${
              filter === c.id
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <ul className="border border-border divide-y divide-border">
        {visible.map((d) => {
          const qty = qtyOf(d.id);
          const unitLabel = d.unit === 'caja' ? 'caja' : 'ud';
          const unitWord = d.unit === 'caja' ? 'caja' : 'unidad';
          return (
            <li
              key={d.id}
              className={`px-3 py-2.5 transition-colors ${
                qty > 0 ? 'bg-secondary' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm leading-tight truncate">
                    {d.name}
                    {d.unit === 'caja' && (
                      <span
                        title="1 caja = 24 unidades"
                        className="ml-2 font-data text-xs uppercase text-primary border border-primary/50 px-1 py-0.5"
                      >
                        caja ×24
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingCost(editingCost === d.id ? null : d.id)}
                    className="font-data text-xs text-muted-foreground uppercase hover:text-primary transition-colors cursor-pointer"
                    aria-label={`Editar coste de ${d.name}`}
                  >
                    {d.unitCost.toFixed(2).replace('.', ',')} € / {unitLabel}
                  </button>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditorFor(editorFor === d.id ? null : d.id)}
                    aria-label={`Editar ${d.name}`}
                    className="h-11 w-9 inline-flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:bg-foreground hover:text-background transition-colors cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {d.custom && onDelete && (
                    <button
                      onClick={() => onDelete(d.id)}
                      aria-label={`Eliminar ${d.name}`}
                      className="h-11 w-9 inline-flex items-center justify-center border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <StepperButton
                    label={`Quitar ${unitWord} de ${d.name}`}
                    disabled={qty === 0}
                    onClick={() => onQty(d.id, qty - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </StepperButton>
                  {editingQty === d.id ? (
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      autoFocus
                      defaultValue={qty || ''}
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => {
                        const n = Math.max(
                          0,
                          Math.floor(Number(e.target.value) || 0),
                        );
                        onQty(d.id, n);
                        setEditingQty(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          (e.target as HTMLInputElement).blur();
                      }}
                      className="w-16 h-11 px-1 text-center bg-card border border-primary font-data text-base font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Cantidad de ${d.name}`}
                    />
                  ) : (
                    <button
                      onClick={() => setEditingQty(d.id)}
                      aria-label={`Escribir cantidad de ${unitWord} de ${d.name}`}
                      className={`w-12 h-11 text-center font-data text-base border border-transparent hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                        qty > 0
                          ? 'font-bold text-primary'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {qty}
                    </button>
                  )}
                  <StepperButton
                    label={`Añadir ${unitWord} de ${d.name}`}
                    onClick={() => onQty(d.id, qty + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </StepperButton>
                </div>
              </div>

              {editingCost === d.id && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    autoFocus
                    defaultValue={d.unitCost}
                    onBlur={(e) => {
                      onCost(d.id, Number(e.target.value) || 0);
                      setEditingCost(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="w-24 h-8 px-2 bg-card border border-input font-data text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Coste"
                  />
                  <span className="font-data text-xs text-muted-foreground">
                    € / {unitLabel}
                  </span>
                </div>
              )}

              {editorFor === d.id && (
                <div className="mt-2">
                  <DrinkEditor
                    title={`Editar · ${d.name}`}
                    initial={d}
                    onSave={(draft) => {
                      onUpsert({ ...d, ...draft });
                      setEditorFor(null);
                    }}
                    onCancel={() => setEditorFor(null)}
                    onDelete={
                      d.custom && onDelete
                        ? () => {
                            onDelete(d.id);
                            setEditorFor(null);
                          }
                        : undefined
                    }
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Editor en línea de un ítem: nombre, categoría, unidad de medida y coste. */
function DrinkEditor({
  title,
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  title: string;
  initial?: Drink;
  onSave: (draft: Omit<Drink, 'id'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<CategoryId>(initial?.category ?? 'otros');
  const [unit, setUnit] = useState<'ud' | 'caja'>(initial?.unit ?? 'ud');
  const [cost, setCost] = useState(initial ? String(initial.unitCost) : '');

  // La caja (24 uds) solo existe para refrescos y zumos; si el ítem ya es
  // caja (p. ej. llegó en el payload), se ofrece la opción para poder revertir.
  const canCaja = category === 'refrescos' || unit === 'caja';
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const onCategoryChange = (c: CategoryId) => {
    setCategory(c);
    if (c !== 'refrescos' && unit === 'caja') {
      // Fuera de refrescos/zumos no hay caja: vuelve a unidad, coste ÷24.
      setUnit('ud');
      const n = Number(cost);
      if (cost !== '' && !Number.isNaN(n)) setCost(String(round2(n / 24)));
    }
  };

  const onUnitChange = (u: 'ud' | 'caja') => {
    if (u === unit) return;
    setUnit(u);
    const n = Number(cost);
    if (cost !== '' && !Number.isNaN(n)) {
      // 1 caja = 24 unidades: al pasar a caja se multiplica, al volver se divide.
      setCost(String(round2(u === 'caja' ? n * 24 : n / 24)));
    }
  };

  const valid = name.trim() && Number(cost) >= 0 && cost !== '';

  return (
    <div className="border border-primary/50 bg-secondary/50 p-3 flex flex-col gap-3">
      <div className="font-data text-xs uppercase tracking-widest text-primary">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 flex flex-col gap-1">
          <span className={labelCls}>Nombre del artículo</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Red Bull"
            autoFocus
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Categoría</span>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as CategoryId)}
            className={inputCls}
          >
            <option value="vinos">Vinos</option>
            <option value="cerveza">Cerveza</option>
            <option value="destilados">Destilados</option>
            <option value="licores">Licores</option>
            <option value="refrescos">Refrescos y zumos</option>
            <option value="otros">Otros</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Unidad de medida</span>
          <select
            value={canCaja ? unit : 'ud'}
            onChange={(e) => onUnitChange(e.target.value as 'ud' | 'caja')}
            className={inputCls}
          >
            <option value="ud">UD · unidad</option>
            {canCaja && <option value="caja">Caja (24 uds)</option>}
          </select>
          {unit === 'caja' && (
            <span className="font-data text-xs uppercase text-muted-foreground">
              1 caja = 24 unidades (refrescos y zumos)
            </span>
          )}
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className={labelCls}>
            Coste por {unit === 'caja' ? 'caja' : 'unidad'} (€)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0,00"
            className={inputCls}
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={!valid}
          onClick={() =>
            onSave({ name: name.trim(), category, unit, unitCost: Number(cost) })
          }
          className="h-10 px-4 bg-primary text-primary-foreground font-data text-xs uppercase tracking-wide font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        >
          Guardar ítem
        </button>
        <button
          onClick={onCancel}
          className="h-10 px-4 border border-border font-data text-xs uppercase tracking-wide hover:bg-foreground hover:text-background transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="h-10 px-3 border border-destructive/50 text-destructive font-data text-xs uppercase tracking-wide hover:bg-destructive hover:text-destructive-foreground transition-colors cursor-pointer"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

const labelCls =
  'font-data text-xs uppercase tracking-wide text-muted-foreground';
const inputCls =
  'w-full h-10 px-3 bg-card border border-input font-data text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'placeholder:text-muted-foreground';

function StepperButton({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-11 w-11 inline-flex items-center justify-center border border-border hover:bg-foreground hover:text-background active:opacity-80 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
    >
      {children}
    </button>
  );
}
