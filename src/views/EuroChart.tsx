import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { EuroSlice } from '@/lib/calc';
import { eur } from '@/views/ui';

/**
 * Doughnut «Dónde va cada euro de venta neta»: misma estructura y colores
 * que la gráfica de la hoja Resumen de la plantilla Excel.
 */
export function EuroChart({ slices, neta }: { slices: EuroSlice[]; neta: number }) {
  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      <h3 className="font-data text-xs uppercase tracking-widest text-muted-foreground">
        Dónde va cada euro de venta neta
      </h3>
      {neta <= 0 || slices.length === 0 ? (
        <p className="py-2 text-center font-data text-xs uppercase tracking-wide text-muted-foreground">
          La gráfica aparecerá cuando haya venta neta que repartir.
        </p>
      ) : (
        <>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="valor"
                  nameKey="nombre"
                  innerRadius="58%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {slices.map((s) => (
                    <Cell key={s.nombre} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => eur(Number(v))}
                  contentStyle={{
                    background: 'hsl(0 0% 8%)',
                    border: '1px solid hsl(0 0% 20%)',
                    fontFamily: "'Space Mono', ui-monospace, monospace",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-col gap-1.5">
            {slices.map((s) => (
              <li key={s.nombre} className="flex items-center gap-2 font-data text-xs">
                <span
                  className="inline-block h-3 w-3 shrink-0"
                  style={{ background: s.color }}
                  aria-hidden
                />
                <span className="flex-1 text-foreground">{s.nombre}</span>
                <span className="text-muted-foreground">{eur(s.valor)}</span>
                <span className="w-16 shrink-0 text-right text-muted-foreground">
                  {((s.valor / neta) * 100).toFixed(1)} %
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
