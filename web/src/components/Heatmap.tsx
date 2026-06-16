'use client';

interface Props {
  rows: string[];
  cols: string[];
  matrix: number[][];
  max: number;
  dark?: boolean;
}

/** Mapa de calor (matriz de conteo) Nivel × Subsistema. Color ∝ valor. */
export function Heatmap({ rows, cols, matrix, max, dark = false }: Props) {
  if (!rows || rows.length === 0 || cols.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-slate-500">Sin datos suficientes.</div>;
  }
  const bg = (v: number) => (v ? `rgba(13,148,136,${0.12 + 0.8 * (v / (max || 1))})` : 'transparent');
  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th></th>
            {cols.map((c) => (
              <th key={c} className="px-2 pb-1 text-[11px] font-bold text-gray-500 dark:text-slate-400">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r}>
              <td className="pr-2 text-[11px] font-semibold text-gray-600 dark:text-slate-300 whitespace-nowrap text-right">{r}</td>
              {cols.map((c, j) => {
                const v = matrix[i]?.[j] || 0;
                return (
                  <td
                    key={c}
                    title={`${r} · ${c}: ${v} tareas`}
                    className="text-center text-[11px] font-semibold rounded-md"
                    style={{ backgroundColor: bg(v), minWidth: 40, height: 30, color: v > max * 0.55 ? '#fff' : dark ? '#94a3b8' : '#475569' }}
                  >
                    {v || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
