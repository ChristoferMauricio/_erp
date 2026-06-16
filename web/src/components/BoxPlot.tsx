'use client';

import { useRef, useState, useEffect } from 'react';

export interface BoxStat {
  name: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  whiskerLo: number;
  whiskerHi: number;
  mean: number;
  outliers: number[];
  count: number;
}

interface Props {
  data: BoxStat[];
  unit?: string;
  color?: string;
  dark?: boolean;
  height?: number;
}

/**
 * Box-and-whisker plot (varias cajas) en SVG puro y responsive.
 * Caja = Q1–Q3, línea = mediana, rombo = media, bigotes = 1.5·IQR, puntos = outliers.
 */
export function BoxPlot({ data, unit = '', color = '#2dd4bf', dark = false, height = 300 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const axis = dark ? '#94a3b8' : '#6b7280';
  const grid = dark ? '#1e293b' : '#eef2f7';
  const medianCol = dark ? '#f8fafc' : '#0f172a';

  if (!data || data.length === 0) {
    return (
      <div ref={ref} className="h-full w-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
        Sin datos suficientes para la distribución.
      </div>
    );
  }

  const m = { top: 16, right: 16, bottom: 50, left: 50 };
  const innerW = Math.max(w - m.left - m.right, 10);
  const innerH = height - m.top - m.bottom;

  const allVals = data.flatMap((d) => [d.whiskerLo, d.whiskerHi, d.max, d.min, ...d.outliers]);
  const yMax = Math.max(...allVals, 1) * 1.08;
  const yMin = 0;
  const yScale = (v: number) => m.top + innerH * (1 - (v - yMin) / (yMax - yMin || 1));
  const band = innerW / data.length;
  const ticks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4);

  const fmt = (x: number) => (Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10);

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      <svg width={w} height={height} role="img">
        {/* grid + eje Y */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={m.left} x2={w - m.right} y1={yScale(t)} y2={yScale(t)} stroke={grid} strokeWidth={1} />
            <text x={m.left - 8} y={yScale(t) + 3} textAnchor="end" fontSize={10} fill={axis}>{fmt(t)}</text>
          </g>
        ))}
        {unit && (
          <text x={14} y={m.top + innerH / 2} fontSize={10} fill={axis} textAnchor="middle"
            transform={`rotate(-90 14 ${m.top + innerH / 2})`}>{unit}</text>
        )}

        {data.map((d, i) => {
          const cx = m.left + band * (i + 0.5);
          const half = Math.min(band * 0.26, 36);
          const yQ1 = yScale(d.q1), yQ3 = yScale(d.q3), yMed = yScale(d.median);
          const yWLo = yScale(d.whiskerLo), yWHi = yScale(d.whiskerHi), yMean = yScale(d.mean);
          return (
            <g key={d.name}>
              <title>{`${d.name}  (n=${d.count})\nmín ${fmt(d.min)} · Q1 ${fmt(d.q1)} · mediana ${fmt(d.median)} · Q3 ${fmt(d.q3)} · máx ${fmt(d.max)}\nmedia ${fmt(d.mean)}`}</title>
              {/* bigote */}
              <line x1={cx} x2={cx} y1={yWHi} y2={yWLo} stroke={color} strokeWidth={1.5} />
              <line x1={cx - half * 0.6} x2={cx + half * 0.6} y1={yWHi} y2={yWHi} stroke={color} strokeWidth={1.5} />
              <line x1={cx - half * 0.6} x2={cx + half * 0.6} y1={yWLo} y2={yWLo} stroke={color} strokeWidth={1.5} />
              {/* caja Q1–Q3 */}
              <rect x={cx - half} y={yQ3} width={half * 2} height={Math.max(yQ1 - yQ3, 1)}
                fill={color} fillOpacity={dark ? 0.22 : 0.16} stroke={color} strokeWidth={1.5} rx={2} />
              {/* mediana */}
              <line x1={cx - half} x2={cx + half} y1={yMed} y2={yMed} stroke={medianCol} strokeWidth={2} />
              {/* media (rombo) */}
              <path d={`M ${cx} ${yMean - 4} L ${cx + 4} ${yMean} L ${cx} ${yMean + 4} L ${cx - 4} ${yMean} Z`}
                fill="none" stroke={medianCol} strokeWidth={1.2} />
              {/* outliers */}
              {d.outliers.map((o, k) => (
                <circle key={k} cx={cx} cy={yScale(o)} r={2.4} fill={color} fillOpacity={0.7} />
              ))}
              {/* etiquetas */}
              <text x={cx} y={height - m.bottom + 16} textAnchor="middle" fontSize={11} fontWeight={600} fill={axis}>{d.name}</text>
              <text x={cx} y={height - m.bottom + 30} textAnchor="middle" fontSize={9} fill={axis}>n={d.count}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
