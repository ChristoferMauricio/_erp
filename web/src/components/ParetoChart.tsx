'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface ParetoPoint { name: string; count: number; acumulado: number }

interface Props {
  data: ParetoPoint[];
  barName?: string;       // p. ej. "Tareas" / "Cantidad" / "Intervenciones"
  barColor?: string;
  gridStroke: string;
  axisStroke: string;
  tooltipStyle: object;
  height?: number;
}

/** Gráfico de Pareto: barras (valor, descendente) + línea de % acumulado (eje derecho). */
export function ParetoChart({ data, barName = 'Valor', barColor = '#2dd4bf', gridStroke, axisStroke, tooltipStyle, height = 320 }: Props) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="name" stroke={axisStroke} fontSize={9} tickLine={false} interval={0} angle={-30} textAnchor="end" height={80} />
          <YAxis yAxisId="left" stroke={axisStroke} fontSize={11} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" stroke={axisStroke} fontSize={11} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
          <Bar yAxisId="left" dataKey="count" name={barName} fill={barColor} radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="acumulado" name="% acumulado" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
