'use client';

import { Calculator } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  que?: ReactNode;        // Qué muestra / mide
  formula?: ReactNode;    // Fórmula (bloque monoespaciado; admite saltos de línea)
  pasos?: ReactNode[];    // Cómo se construye (lista numerada)
  leer?: ReactNode;       // Cómo interpretarlo
  nota?: ReactNode;       // Supuestos / aclaraciones
  children?: ReactNode;   // compatibilidad
}

function Bloque({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-1">{label}</div>
      <div className="text-[11.5px] leading-relaxed text-gray-600 dark:text-slate-300">{children}</div>
    </div>
  );
}

/** Nota desplegable "Cómo se calcula" con formato estructurado y detallado. */
export function HowCalc({ que, formula, pasos, leer, nota, children }: Props) {
  return (
    <details className="mt-2">
      <summary className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 cursor-pointer select-none flex items-center gap-1.5 w-fit hover:text-teal-700 dark:hover:text-teal-300">
        <Calculator className="h-3.5 w-3.5" /> Cómo se calcula
      </summary>
      <div className="mt-2 bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
        {que && <Bloque label="Qué muestra">{que}</Bloque>}
        {formula && (
          <Bloque label="Fórmula">
            <code className="block bg-white dark:bg-slate-900/70 border border-gray-200 dark:border-slate-700 rounded-md px-2.5 py-2 font-mono text-[11px] text-gray-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{formula}</code>
          </Bloque>
        )}
        {pasos && pasos.length > 0 && (
          <Bloque label="Cómo se construye">
            <ol className="list-decimal pl-4 space-y-1 marker:text-teal-500 marker:font-semibold">
              {pasos.map((p, i) => <li key={i}>{p}</li>)}
            </ol>
          </Bloque>
        )}
        {leer && <Bloque label="Cómo leerlo">{leer}</Bloque>}
        {nota && (
          <p className="text-[10.5px] italic text-gray-400 dark:text-slate-500 pt-0.5">Nota: {nota}</p>
        )}
        {children}
      </div>
    </details>
  );
}
