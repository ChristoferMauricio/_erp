'use client';

import { Info } from 'lucide-react';

const SUBS: [string, string, string][] = [
  ['DAT', 'Datos', 'materiales para enviar datos al interior de la mina (cables UTP, RJ45, switches, etc.).'],
  ['CCTV', 'Cámaras', 'cámaras y materiales relacionados (p. ej. cable UTP usado para reparar una cámara).'],
  ['RAD', 'Radio', 'equipos y materiales de radiocomunicación.'],
  ['TEL', 'Teléfono', 'equipos y materiales de telefonía.'],
  ['GEO', 'Geomecánica', 'geófonos, geomecánica y todo lo relacionado con esos términos.'],
  ['FO', 'Fibra óptica', 'materiales y equipos de fibra óptica.'],
  ['WIFI', 'WiFi', 'equipos y materiales de redes WiFi.'],
];

/** Glosario desplegable de las siglas de subsistemas. Se coloca donde aparezcan los códigos. */
export function SubsistemaGlosario() {
  return (
    <details className="mt-2">
      <summary className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer select-none flex items-center gap-1 w-fit">
        <Info className="h-3 w-3" /> Glosario de subsistemas
      </summary>
      <div className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 rounded-lg p-3 space-y-1">
        {SUBS.map(([code, corto, desc]) => (
          <p key={code}>
            <strong className="text-gray-700 dark:text-slate-200">{code}</strong> — {corto}: {desc}
          </p>
        ))}
      </div>
    </details>
  );
}
