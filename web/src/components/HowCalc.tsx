'use client';

import { Calculator } from 'lucide-react';
import type { ReactNode } from 'react';

/** Nota desplegable "Cómo se calcula" para documentar la metodología de cada gráfico/métrica. */
export function HowCalc({ children }: { children: ReactNode }) {
  return (
    <details className="mt-2">
      <summary className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 cursor-pointer select-none flex items-center gap-1 w-fit">
        <Calculator className="h-3 w-3" /> Cómo se calcula
      </summary>
      <div className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 rounded-lg p-3 space-y-1">
        {children}
      </div>
    </details>
  );
}
