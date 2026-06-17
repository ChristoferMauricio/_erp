"use server";

import { Pool } from 'pg';
import type { TareaParsed } from '@/lib/excelParser';

// Lazy-load del parser Excel solo cuando se necesite (evita importar `fs` en producción)
async function loadExcelData(): Promise<TareaParsed[]> {
  try {
    const { getExcelData } = await import('@/lib/excelParser');
    return getExcelData();
  } catch (e) {
    console.warn("Excel fallback no disponible:", e);
    return [];
  }
}

// Inicializar Pool de conexiones a base de datos (Supabase) si la URL está presente
const dbUrl = process.env.DATABASE_URL;
let pool: Pool | null = null;

if (dbUrl) {
  // SSL solo para conexiones remotas (Supabase). En local (Docker/localhost) se desactiva.
  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('sslmode=disable');
  pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false }
  });
}

// URL del microservicio de predicción (server-to-server; no se expone al navegador)
const PREDICTIVE_URL = process.env.PREDICTIVE_API_URL || 'http://127.0.0.1:8000';

// ===== Helpers de analítica de carga (compartidos por ambas rutas) =====

// Proyección baseline: regresión lineal simple sobre el índice temporal.
// Con <3 puntos cae a la media (el histórico es corto, ver TdR §10).
function proyectarBaseline(values: number[], meses: number): number[] {
  const n = values.length;
  if (n === 0) return Array(meses).fill(0);
  if (n < 3) {
    const m = values.reduce((a, b) => a + b, 0) / n;
    return Array(meses).fill(Math.max(0, m));
  }
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  const out: number[] = [];
  for (let k = 1; k <= meses; k++) out.push(Math.max(0, intercept + slope * (n - 1 + k)));
  return out;
}

function siguientesMeses(ultimoMes: string | null, meses: number): string[] {
  const out: string[] = [];
  let d = ultimoMes ? new Date(`${ultimoMes}-01T00:00:00`) : new Date();
  for (let i = 0; i < meses; i++) {
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

interface PuntoCarga {
  month: string;
  hh: number | null;
  tareas: number | null;
  hhProy: number | null;
  tareasProy: number | null;
}

// Une el histórico de carga (HH y nº tareas por mes) con la proyección a N meses.
// El último punto histórico siembra la línea de proyección para que conecte visualmente.
function construirProyeccionCarga(
  serie: { month: string; hh: number; tareas: number }[],
  meses = 3
): PuntoCarga[] {
  const ordenada = [...serie].sort((a, b) => a.month.localeCompare(b.month));
  const hhProj = proyectarBaseline(ordenada.map(s => s.hh), meses);
  const tareasProj = proyectarBaseline(ordenada.map(s => s.tareas), meses);

  const result: PuntoCarga[] = ordenada.map(s => ({
    month: s.month, hh: s.hh, tareas: s.tareas, hhProy: null, tareasProy: null
  }));
  if (result.length > 0) {
    result[result.length - 1].hhProy = ordenada[ordenada.length - 1].hh;
    result[result.length - 1].tareasProy = ordenada[ordenada.length - 1].tareas;
  }
  const ultimo = ordenada.length ? ordenada[ordenada.length - 1].month : null;
  const futuros = siguientesMeses(ultimo, meses);
  for (let i = 0; i < meses; i++) {
    result.push({
      month: futuros[i], hh: null, tareas: null,
      hhProy: Math.round(hhProj[i]), tareasProy: Math.round(tareasProj[i])
    });
  }
  return result;
}

export type DashFilters = { subsistema?: string; tipo?: string; origen?: string };

interface DashTask {
  tipo: string;
  origen: string;
  causa_raiz: string;
  subsistema: string;
  ubicacion: { nivel: string; zona: string; punto: string | null };
  cant_personas: number;
  tiempo_horas: number;
  horas_hombre: number;
  periodo: string | null;
  detalle: string | null;
  insumos: { name: string; cantidad: number; unidad: string; esLineaSeparada: boolean }[];
}

// Subsistema según el código entre paréntesis de la causa (p.ej. "...(CCTV)")
function inferSub(causa: string | null | undefined): string {
  if (!causa) return 'DAT';
  const m = causa.match(/\(([A-Za-z\-]+)\)/);
  if (m) { const c = m[1].toUpperCase(); return c === 'WI-FI' ? 'WIFI' : c; }
  return 'DAT';
}

function taskMatchesFilters(t: DashTask, f: DashFilters): boolean {
  if (f.subsistema && t.subsistema !== f.subsistema) return false;
  if (f.tipo && t.tipo !== f.tipo) return false;
  if (f.origen && t.origen !== f.origen) return false;
  return true;
}

// Construye TODO el dashboard a partir de una lista de tareas (de BD o Excel).
// Unifica la analítica: los filtros solo recortan esta lista y todo se recalcula.
// Estadística descriptiva para boxplots (cuartiles por interpolación + bigotes 1.5·IQR + outliers)
function quartiles(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const q = (p: number) => {
    if (n === 0) return 0;
    const idx = p * (n - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return s[lo] + (s[hi] - s[lo]) * (idx - lo);
  };
  const q1 = q(0.25), median = q(0.5), q3 = q(0.75);
  const iqr = q3 - q1;
  const loF = q1 - 1.5 * iqr, hiF = q3 + 1.5 * iqr;
  const inside = s.filter(v => v >= loF && v <= hiF);
  const mean = n ? s.reduce((a, b) => a + b, 0) / n : 0;
  const r = (x: number) => Math.round(x * 100) / 100;
  return {
    min: r(s[0] ?? 0), q1: r(q1), median: r(median), q3: r(q3), max: r(s[n - 1] ?? 0),
    whiskerLo: r(inside.length ? inside[0] : (s[0] ?? 0)),
    whiskerHi: r(inside.length ? inside[inside.length - 1] : (s[n - 1] ?? 0)),
    mean: r(mean),
    outliers: s.filter(v => v < loF || v > hiF).slice(0, 40).map(r),
  };
}

function buildHistogram(values: number[], bins: number) {
  if (!values.length) return [] as { rango: string; count: number }[];
  const min = Math.min(...values), max = Math.max(...values);
  if (max === min) return [{ rango: `${Math.round(min * 10) / 10}`, count: values.length }];
  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  values.forEach(v => { let i = Math.floor((v - min) / width); if (i >= bins) i = bins - 1; counts[i]++; });
  const r = (x: number) => Math.round(x * 10) / 10;
  return counts.map((c, i) => ({ rango: `${r(min + i * width)}–${r(min + (i + 1) * width)}`, count: c }));
}

// Desviación estándar muestral (para las bandas de confianza de las predicciones)
function stddev(values: number[]) {
  const v = values.filter(x => typeof x === 'number' && !isNaN(x));
  if (v.length < 2) return 0;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

function buildDashboardFromTasks(tasks: DashTask[], source: string) {
  const totalTasks = tasks.length;

  let totalInsumosQty = 0;
  const insumosCountMap: { [k: string]: number } = {};
  const subsistemaCountMap: { [k: string]: number } = {};
  const originCountMap: { [k: string]: number } = { IM: 0, SUP: 0 };
  const tipoCountMap: { [k: string]: number } = { Incidente: 0, Requerimiento: 0 };
  let totalPerson = 0, totalHours = 0, totalHH = 0;
  const periodMap: { [k: string]: { incidentes: number; requerimientos: number } } = {};
  const locationFaultsMap: { [k: string]: number } = {};
  const causaMap: { [k: string]: { count: number; horas: number; hh: number; detalles: { [d: string]: number } } } = {};
  const nivelMap: { [k: string]: { hh: number; horas: number; tareas: number } } = {};
  const insumoHHMap: { [k: string]: number } = {};
  const insumoHorasMap: { [k: string]: number } = {};
  const hhPeriodMap: { [k: string]: { hh: number; tareas: number } } = {};
  let lineasMaterial = 0, actividadesConMaterial = 0;
  const suministrosPorUnidad: { [u: string]: number } = { UN: 0, M: 0, LT: 0 };
  // ANS/SLA por esfuerzo (columna Tiempo): objetivo de horas por tipo de tarea
  const SLA_OBJETIVO: { [tipo: string]: number } = { Incidente: 3, Requerimiento: 4 };
  let slaTotal = 0, slaCumple = 0;
  const slaPorTipo: { [tipo: string]: { total: number; cumple: number } } = {
    Incidente: { total: 0, cumple: 0 },
    Requerimiento: { total: 0, cumple: 0 }
  };
  // Datos para gráficos estadísticos (dispersión, boxplots, histograma)
  const dispersion: { personas: number; tiempo: number; hh: number; tipo: string; sub: string }[] = [];
  const tiempoPorSub: { [k: string]: number[] } = {};
  const hhPorTipo: { [k: string]: number[] } = {};
  const tiempoTodos: number[] = [];
  const nivelSubMap: { [niv: string]: { [sub: string]: number } } = {};
  const hhBySubMap: { [k: string]: number } = {};
  const dispersionInsumos: { nInsumos: number; hh: number; tipo: string }[] = [];

  tasks.forEach(t => {
    totalPerson += t.cant_personas || 0;
    totalHours += t.tiempo_horas || 0;
    totalHH += t.horas_hombre || 0;

    const _tiempo = t.tiempo_horas || 0;
    const _personas = t.cant_personas || 0;
    const _sub = t.subsistema || 'DAT';
    const _tipo = t.tipo === 'Incidente' ? 'Incidente' : 'Requerimiento';
    if (_tiempo > 0) {
      tiempoTodos.push(_tiempo);
      (tiempoPorSub[_sub] = tiempoPorSub[_sub] || []).push(_tiempo);
    }
    if ((t.horas_hombre || 0) > 0) (hhPorTipo[_tipo] = hhPorTipo[_tipo] || []).push(t.horas_hombre);
    if (_tiempo > 0 && _personas > 0 && dispersion.length < 2000) {
      dispersion.push({ personas: _personas, tiempo: Math.round(_tiempo * 100) / 100, hh: Math.round(t.horas_hombre || 0), tipo: _tipo, sub: _sub });
    }
    if (t.insumos.length > 0 && (t.horas_hombre || 0) > 0 && dispersionInsumos.length < 2000) {
      dispersionInsumos.push({ nInsumos: t.insumos.length, hh: Math.round(t.horas_hombre || 0), tipo: _tipo });
    }

    const causaKey = t.causa_raiz || 'Mantenimiento Programado';
    if (!causaMap[causaKey]) causaMap[causaKey] = { count: 0, horas: 0, hh: 0, detalles: {} };
    causaMap[causaKey].count++;
    causaMap[causaKey].horas += t.tiempo_horas || 0;
    causaMap[causaKey].hh += t.horas_hombre || 0;
    const detKey = (t.detalle && t.detalle.trim()) ? t.detalle.trim() : '(sin detalle)';
    causaMap[causaKey].detalles[detKey] = (causaMap[causaKey].detalles[detKey] || 0) + 1;

    const nivKey = t.ubicacion.nivel || 'Interior Mina';
    if (!nivelMap[nivKey]) nivelMap[nivKey] = { hh: 0, horas: 0, tareas: 0 };
    nivelMap[nivKey].hh += t.horas_hombre || 0;
    nivelMap[nivKey].horas += t.tiempo_horas || 0;
    nivelMap[nivKey].tareas++;

    if (t.periodo) {
      const m = t.periodo.substring(0, 7);
      if (!hhPeriodMap[m]) hhPeriodMap[m] = { hh: 0, tareas: 0 };
      hhPeriodMap[m].hh += t.horas_hombre || 0;
      hhPeriodMap[m].tareas++;
    }

    const subCode = t.subsistema || 'DAT';
    subsistemaCountMap[subCode] = (subsistemaCountMap[subCode] || 0) + 1;
    const _ns = nivelSubMap[nivKey] = nivelSubMap[nivKey] || {};
    _ns[subCode] = (_ns[subCode] || 0) + 1;
    hhBySubMap[subCode] = (hhBySubMap[subCode] || 0) + (t.horas_hombre || 0);

    if (t.origen === 'SUP') originCountMap.SUP++; else originCountMap.IM++;
    const tipoKey = t.tipo === 'Incidente' ? 'Incidente' : 'Requerimiento';
    tipoCountMap[tipoKey]++;
    // ANS por esfuerzo: contar solo tareas con tiempo registrado (>0)
    if ((t.tiempo_horas || 0) > 0) {
      slaTotal++;
      slaPorTipo[tipoKey].total++;
      if (t.tiempo_horas <= SLA_OBJETIVO[tipoKey]) { slaCumple++; slaPorTipo[tipoKey].cumple++; }
    }

    const locName = `${t.ubicacion.nivel} > ${t.ubicacion.zona}`;
    locationFaultsMap[locName] = (locationFaultsMap[locName] || 0) + 1;

    if (t.periodo) {
      const month = t.periodo.substring(0, 7);
      if (!periodMap[month]) periodMap[month] = { incidentes: 0, requerimientos: 0 };
      if (t.tipo === 'Incidente') periodMap[month].incidentes++; else periodMap[month].requerimientos++;
    }

    t.insumos.forEach(ins => {
      totalInsumosQty += ins.cantidad;
      insumosCountMap[ins.name] = (insumosCountMap[ins.name] || 0) + ins.cantidad;
      insumoHHMap[ins.name] = (insumoHHMap[ins.name] || 0) + (t.horas_hombre || 0);
      insumoHorasMap[ins.name] = (insumoHorasMap[ins.name] || 0) + (t.tiempo_horas || 0);
      const u = suministrosPorUnidad[ins.unidad] !== undefined ? ins.unidad : 'UN';
      suministrosPorUnidad[u] += ins.cantidad;
    });
    // Modelo de bloque: cada actividad es cabecera + sus filas de material
    lineasMaterial += t.insumos.length;
    if (t.insumos.length > 0) actividadesConMaterial++;
  });

  // ---- estadística descriptiva: boxplots + histograma + correlación ----
  const boxFrom = (m: { [k: string]: number[] }, minN: number) =>
    Object.entries(m).filter(([, v]) => v.length >= minN)
      .map(([name, v]) => ({ name, ...quartiles(v), count: v.length }));
  const boxTiempoSub = boxFrom(tiempoPorSub, 5).sort((a, b) => b.median - a.median);
  const boxHHTipo = boxFrom(hhPorTipo, 1).sort((a, b) => a.name.localeCompare(b.name));
  const histTiempo = buildHistogram(tiempoTodos, 12);
  let corrPersonasTiempo = 0;
  if (dispersion.length > 2) {
    const xs = dispersion.map(d => d.personas), ys = dispersion.map(d => d.tiempo);
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
    corrPersonasTiempo = (dx > 0 && dy > 0) ? Math.round((num / Math.sqrt(dx * dy)) * 100) / 100 : 0;
  }

  // Pareto de Causa Raíz (top 10 + 'Otros') con % acumulado
  const _causaArr = Object.entries(causaMap).map(([name, v]) => ({ name, count: v.count })).sort((a, b) => b.count - a.count);
  const _totalCausa = _causaArr.reduce((s, x) => s + x.count, 0) || 1;
  const _restCausa = _causaArr.slice(10).reduce((s, x) => s + x.count, 0);
  const _paretoBase = _restCausa > 0 ? [..._causaArr.slice(0, 10), { name: 'Otros', count: _restCausa }] : _causaArr.slice(0, 10);
  let _acc = 0;
  const paretoCausas = _paretoBase.map(x => { _acc += x.count; return { name: x.name, count: x.count, acumulado: Math.round((_acc / _totalCausa) * 1000) / 10 }; });

  // Mapa de calor Nivel × Subsistema (top 10 niveles por volumen)
  const _subOrder = ['DAT', 'CCTV', 'RAD', 'TEL', 'GEO', 'FO', 'WIFI'];
  const _nivOrdered = Object.entries(nivelSubMap)
    .map(([niv, mm]) => ({ niv, total: Object.values(mm).reduce((s, x) => s + x, 0) }))
    .sort((a, b) => b.total - a.total).slice(0, 10);
  const heatRows = _nivOrdered.map(x => x.niv);
  const heatCols = _subOrder.filter(s => heatRows.some(r => (nivelSubMap[r] || {})[s]));
  const heatMatrix = heatRows.map(r => heatCols.map(c => (nivelSubMap[r] || {})[c] || 0));
  const heatNivelSub = { rows: heatRows, cols: heatCols, matrix: heatMatrix, max: Math.max(1, ...heatMatrix.flat()) };

  // Radar por subsistema: % de tareas y % de HH (cada uno normalizado a su máximo)
  const _maxTareasSub = Math.max(1, ...Object.values(subsistemaCountMap));
  const _maxHHSub = Math.max(1, ...Object.values(hhBySubMap));
  const radarSub = Object.keys(subsistemaCountMap).sort().map(sub => ({
    sub,
    tareasPct: Math.round((subsistemaCountMap[sub] / _maxTareasSub) * 100),
    hhPct: Math.round(((hhBySubMap[sub] || 0) / _maxHHSub) * 100),
  }));

  const topInsumos = Object.entries(insumosCountMap)
    .map(([name, val]) => ({ name, value: Math.round(val * 100) / 100 }))
    .sort((a, b) => b.value - a.value).slice(0, 8);
  const subsistemas = Object.entries(subsistemaCountMap)
    .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const topLocations = Object.entries(locationFaultsMap)
    .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  const monthlyTrend = Object.entries(periodMap)
    .map(([month, val]) => ({ month, incidentes: val.incidentes, requerimientos: val.requerimientos, total: val.incidentes + val.requerimientos }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const hhPorCausa = Object.entries(causaMap)
    .map(([name, v]) => ({ name, tareas: v.count, horas: Math.round(v.horas), hh: Math.round(v.hh) }))
    .sort((a, b) => b.hh - a.hh).slice(0, 8);
  const hhPorNivel = Object.entries(nivelMap)
    .map(([name, v]) => ({ name, hh: Math.round(v.hh), horas: Math.round(v.horas), tareas: v.tareas }))
    .sort((a, b) => b.hh - a.hh).slice(0, 8);
  const causaDetalle = Object.entries(causaMap)
    .sort((a, b) => b[1].count - a[1].count).slice(0, 6)
    .map(([name, v]) => ({
      name, total: v.count, hh: Math.round(v.hh),
      detalles: Object.entries(v.detalles).map(([d, c]) => ({ name: d, value: c })).sort((a, b) => b.value - a.value).slice(0, 5)
    }));
  const mermas = Object.keys(insumosCountMap)
    .map(name => {
      const qty = insumosCountMap[name];
      const hh = insumoHHMap[name] || 0;
      const horas = insumoHorasMap[name] || 0;
      return {
        name, cantidad: Math.round(qty * 100) / 100, hh: Math.round(hh),
        porHH: hh > 0 ? Math.round((qty / hh) * 1000) / 1000 : 0,
        porHora: horas > 0 ? Math.round((qty / horas) * 1000) / 1000 : 0
      };
    })
    .filter(x => x.hh >= 10).sort((a, b) => b.porHH - a.porHH).slice(0, 8);
  const materialesResumen = {
    actividades: totalTasks,
    lineasMaterial,
    promPorActividad: totalTasks ? Math.round((lineasMaterial / totalTasks) * 10) / 10 : 0,
    actividadesConMaterial,
    pctConMaterial: totalTasks ? Math.round((actividadesConMaterial / totalTasks) * 100) : 0
  };
  const cargaSerie = Object.entries(hhPeriodMap).map(([month, v]) => ({ month, hh: Math.round(v.hh), tareas: v.tareas }));
  const cargaProyeccion = construirProyeccionCarga(cargaSerie, 3);
  const insumoNames = Object.keys(insumosCountMap).sort((a, b) => insumosCountMap[b] - insumosCountMap[a]);

  // (12) Suministros por unidad (UN/M/LT son magnitudes distintas: no se suman entre sí)
  const suministros = {
    UN: Math.round(suministrosPorUnidad.UN || 0),
    M: Math.round(suministrosPorUnidad.M || 0),
    LT: Math.round((suministrosPorUnidad.LT || 0) * 100) / 100
  };

  // (10) ANS/SLA usando la columna Tiempo como esfuerzo de resolución (las fechas no sirven)
  const mkSla = (o: { total: number; cumple: number }, objetivo: number, tipo: string) => ({
    tipo, objetivo, total: o.total, cumple: o.cumple,
    pct: o.total ? Math.round((o.cumple / o.total) * 100) : 0
  });
  const sla = {
    total: slaTotal,
    cumple: slaCumple,
    pct: slaTotal ? Math.round((slaCumple / slaTotal) * 100) : 0,
    porTipo: [
      mkSla(slaPorTipo.Incidente, SLA_OBJETIVO.Incidente, 'Incidente'),
      mkSla(slaPorTipo.Requerimiento, SLA_OBJETIVO.Requerimiento, 'Requerimiento')
    ]
  };

  return {
    totalTasks,
    totalInsumosQty: Math.round(totalInsumosQty),
    avgPerson: totalTasks ? Math.round((totalPerson / totalTasks) * 10) / 10 : 0,
    avgHours: totalTasks ? Math.round((totalHours / totalTasks) * 10) / 10 : 0,
    totalHH: Math.round(totalHH),
    totalHoras: Math.round(totalHours),
    topInsumos, subsistemas, topLocations, monthlyTrend,
    hhPorCausa, hhPorNivel, causaDetalle, mermas, materialesResumen, cargaProyeccion,
    insumoNames, suministros, sla,
    dispersion, boxTiempoSub, boxHHTipo, histTiempo, corrPersonasTiempo,
    paretoCausas, heatNivelSub, radarSub, dispersionInsumos,
    originDistribution: [
      { name: 'Interior Mina', value: originCountMap.IM },
      { name: 'Superficie', value: originCountMap.SUP }
    ],
    tipoDistribution: [
      { name: 'Incidentes', value: tipoCountMap.Incidente },
      { name: 'Requerimientos', value: tipoCountMap.Requerimiento }
    ],
    source
  };
}

export async function fetchDashboardData(filters: DashFilters = {}) {
  if (pool) {
    try {
      const client = await pool.connect();
      const where: string[] = [];
      const params: any[] = [];
      let pi = 1;
      if (filters.tipo) { where.push(`ct.nombre = $${pi++}`); params.push(filters.tipo); }
      if (filters.origen) { where.push(`co.nombre = $${pi++}`); params.push(filters.origen); }
      if (filters.subsistema) { where.push(`cs.codigo = $${pi++}`); params.push(filters.subsistema); }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

      // Filas de tarea con dimensiones (filtros aplicados en SQL)
      const tareasRes = await client.query(`
        SELECT t.id, ct.nombre AS tipo, co.nombre AS origen,
               COALESCE(cr.nombre, 'Mantenimiento Programado') AS causa_raiz,
               COALESCE(cs.codigo, 'DAT') AS subsistema,
               COALESCE(u.nivel, 'Interior Mina') AS nivel,
               COALESCE(u.zona, 'General') AS zona, u.punto,
               COALESCE(t.cant_personas, 0) AS cant_personas,
               COALESCE(t.tiempo_horas, 0)::float AS tiempo_horas,
               to_char(t.periodo, 'YYYY-MM') AS periodo, t.detalle
        FROM tarea t
        JOIN cat_tipo ct ON t.tipo_id = ct.id
        JOIN cat_origen co ON t.origen_id = co.id
        LEFT JOIN cat_causa_raiz cr ON t.causa_raiz_id = cr.id
        LEFT JOIN cat_subsistema cs ON cr.subsistema_id = cs.id
        LEFT JOIN ubicacion u ON t.ubicacion_id = u.id
        ${whereSql}
      `, params);

      const insumosRes = await client.query(`
        SELECT ti.tarea_id, i.nombre_normalizado AS name, ti.cantidad::float AS cantidad, cum.simbolo AS unidad
        FROM tarea_insumo ti
        JOIN insumo i ON ti.insumo_id = i.id
        JOIN cat_unidad_medida cum ON ti.unidad_medida_id = cum.id
        JOIN tarea t ON ti.tarea_id = t.id
        JOIN cat_tipo ct ON t.tipo_id = ct.id
        JOIN cat_origen co ON t.origen_id = co.id
        LEFT JOIN cat_causa_raiz cr ON t.causa_raiz_id = cr.id
        LEFT JOIN cat_subsistema cs ON cr.subsistema_id = cs.id
        ${whereSql}
      `, params);

      client.release();

      const insByTask: { [k: string]: { name: string; cantidad: number; unidad: string; esLineaSeparada: boolean }[] } = {};
      insumosRes.rows.forEach((r: any) => {
        if (!insByTask[r.tarea_id]) insByTask[r.tarea_id] = [];
        insByTask[r.tarea_id].push({ name: r.name, cantidad: r.cantidad, unidad: r.unidad || 'UN', esLineaSeparada: false });
      });
      const tasks: DashTask[] = tareasRes.rows.map((r: any) => ({
        tipo: r.tipo,
        origen: r.origen,
        causa_raiz: r.causa_raiz,
        subsistema: r.subsistema,
        ubicacion: { nivel: r.nivel, zona: r.zona, punto: r.punto },
        cant_personas: r.cant_personas,
        tiempo_horas: r.tiempo_horas,
        horas_hombre: (r.cant_personas || 0) * (r.tiempo_horas || 0),
        periodo: r.periodo,
        detalle: r.detalle,
        insumos: insByTask[r.id] || []
      }));
      return buildDashboardFromTasks(tasks, 'supabase');
    } catch (error) {
      console.error("Error al consultar Supabase, reintentando con Excel local:", error);
    }
  }

  // --- FALLBACK EXCEL LOCAL ---
  const raw = await loadExcelData();
  const tasks: DashTask[] = raw
    .map(t => ({
      tipo: t.tipo,
      origen: t.origen,
      causa_raiz: t.causa_raiz || 'Mantenimiento Programado',
      subsistema: inferSub(t.causa_raiz),
      ubicacion: {
        nivel: t.ubicacion.nivel || 'Interior Mina',
        zona: t.ubicacion.zona || 'General',
        punto: t.ubicacion.punto
      },
      cant_personas: t.cant_personas || 0,
      tiempo_horas: t.tiempo_horas || 0,
      horas_hombre: t.horas_hombre || 0,
      periodo: t.periodo,
      detalle: t.detalle,
      insumos: t.insumos.map(i => ({ name: i.name, cantidad: i.cantidad, unidad: i.unidad, esLineaSeparada: i.esLineaSeparada }))
    }))
    .filter(t => taskMatchesFilters(t, filters));
  return buildDashboardFromTasks(tasks, 'excel');
}


export async function fetchTasks(page = 1, limit = 50, search = '', typeFilter = '', originFilter = '') {
  if (pool) {
    try {
      const client = await pool.connect();
      
      let query = `
        SELECT t.id, t.ticket, ct.nombre as tipo, co.nombre as origen,
               u.nivel, u.zona, u.punto, u.texto_original as ubicacion_original,
               cr.nombre as causa_raiz, t.cant_personas, t.tiempo_horas,
               t.fecha_inicio, t.fecha_fin, t.periodo, t.detalle, t.trabajo_realizado
        FROM tarea t
        JOIN cat_tipo ct ON t.tipo_id = ct.id
        JOIN cat_origen co ON t.origen_id = co.id
        JOIN ubicacion u ON t.ubicacion_id = u.id
        JOIN cat_causa_raiz cr ON t.causa_raiz_id = cr.id
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (search) {
        query += ` AND (
          t.ticket ILIKE $${paramIndex} OR 
          t.detalle ILIKE $${paramIndex} OR 
          t.trabajo_realizado ILIKE $${paramIndex} OR 
          u.texto_original ILIKE $${paramIndex} OR 
          cr.nombre ILIKE $${paramIndex}
        )`;
        params.push(`%${search}%`);
        paramIndex++;
      }
      
      if (typeFilter) {
        query += ` AND ct.nombre = $${paramIndex}`;
        params.push(typeFilter);
        paramIndex++;
      }
      
      if (originFilter) {
        query += ` AND co.nombre = $${paramIndex}`;
        params.push(originFilter);
        paramIndex++;
      }
      
      // Consultar conteo total primero
      const countQuery = `SELECT COUNT(*) FROM (${query}) as total_rows`;
      const countRes = await client.query(countQuery, params);
      const total = parseInt(countRes.rows[0].count);
      
      // Paginación
      const offset = (page - 1) * limit;
      query += ` ORDER BY t.fecha_inicio DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      
      const tasksRes = await client.query(query, params);
      
      // Cargar insumos para cada tarea seleccionada
      const tasksWithInsumos = await Promise.all(
        tasksRes.rows.map(async (row: any) => {
          const insumosRes = await client.query(`
            SELECT i.nombre_normalizado as name, ti.cantidad::float, cum.simbolo as unidad
            FROM tarea_insumo ti
            JOIN insumo i ON ti.insumo_id = i.id
            JOIN cat_unidad_medida cum ON ti.unidad_medida_id = cum.id
            WHERE ti.tarea_id = $1
          `, [row.id]);
          
          return {
            id: row.id,
            ticket: row.ticket,
            tipo: row.tipo,
            origen: row.origen,
            ubicacion: {
              nivel: row.nivel,
              zona: row.zona,
              punto: row.punto,
              texto_original: row.ubicacion_original
            },
            causa_raiz: row.causa_raiz,
            cant_personas: row.cant_personas,
            tiempo_horas: parseFloat(row.tiempo_horas),
            fecha_inicio: row.fecha_inicio ? row.fecha_inicio.toISOString() : null,
            fecha_fin: row.fecha_fin ? row.fecha_fin.toISOString() : null,
            periodo: row.periodo ? row.periodo.toISOString().substring(0, 10) : null,
            detalle: row.detalle,
            trabajo_realizado: row.trabajo_realizado,
            insumos: insumosRes.rows
          };
        })
      );
      
      client.release();
      
      return {
        items: tasksWithInsumos,
        total,
        pages: Math.ceil(total / limit)
      };
      
    } catch (error) {
      console.error("Error al consultar tareas en Supabase, reintentando con Excel:", error);
    }
  }

  // --- FALLBACK EXCEL LOCAL ---
  const data = await loadExcelData();
  let filtered = data;
  
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(t => 
      (t.ticket && t.ticket.toLowerCase().includes(s)) ||
      (t.detalle && t.detalle.toLowerCase().includes(s)) ||
      (t.trabajo_realizado && t.trabajo_realizado.toLowerCase().includes(s)) ||
      (t.ubicacion.texto_original && t.ubicacion.texto_original.toLowerCase().includes(s)) ||
      (t.causa_raiz && t.causa_raiz.toLowerCase().includes(s))
    );
  }
  
  if (typeFilter) {
    filtered = filtered.filter(t => t.tipo === typeFilter);
  }
  
  if (originFilter) {
    filtered = filtered.filter(t => t.origen === originFilter);
  }
  
  const total = filtered.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const items = filtered.slice(start, end);

  return {
    items,
    total,
    pages: Math.ceil(total / limit)
  };
}

// ===================== PREDICCIÓN (microservicio FastAPI) =====================

// Proyección de carga de trabajo (HH y nº tareas/mes) desde /predict/carga.
// Devuelve puntos listos para el área (histórico sólido + proyección punteada).
// Si el microservicio no responde, ok:false (la UI cae al baseline local).
export async function fetchCargaPrediction(meses = 3) {
  try {
    const res = await fetch(`${PREDICTIVE_URL}/predict/carga?meses_proyeccion=${meses}`, { cache: 'no-store' });
    if (!res.ok) return { ok: false, data: [] as any[] };
    const j = await res.json();
    const hist = j.historico || [];
    const proy = j.proyeccion || [];
    const sHH = stddev(hist.map((h: any) => h.hh));
    const sTar = stddev(hist.map((h: any) => h.tareas));
    const z = 1.28; // ~80%
    const points = hist.map((h: any) => ({
      month: h.month, hh: Math.round(h.hh), tareas: h.tareas,
      hhProy: null as number | null, tareasProy: null as number | null,
      hhBanda: null as number[] | null, tareasBanda: null as number[] | null
    }));
    if (points.length) {
      const last = hist[hist.length - 1];
      points[points.length - 1].hhProy = Math.round(last.hh);
      points[points.length - 1].tareasProy = last.tareas;
      points[points.length - 1].hhBanda = [Math.round(last.hh), Math.round(last.hh)];
      points[points.length - 1].tareasBanda = [last.tareas, last.tareas];
    }
    proy.forEach((p: any, i: number) => {
      const k = z * Math.sqrt(i + 1);
      points.push({
        month: p.month, hh: null, tareas: null,
        hhProy: Math.round(p.hh), tareasProy: p.tareas,
        hhBanda: [Math.max(0, Math.round(p.hh - k * sHH)), Math.round(p.hh + k * sHH)],
        tareasBanda: [Math.max(0, Math.round(p.tareas - k * sTar)), Math.round(p.tareas + k * sTar)]
      });
    });
    return { ok: true, data: points };
  } catch {
    return { ok: false, data: [] as any[] };
  }
}

// Predicción de demanda de un insumo desde /predict/insumos.
export async function fetchInsumosPrediction(insumo: string, meses = 3) {
  try {
    const url = `${PREDICTIVE_URL}/predict/insumos?meses_proyeccion=${meses}` +
      (insumo ? `&insumo_nombre=${encodeURIComponent(insumo)}` : '');
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { ok: false, insumo, data: [] as any[] };
    const j = await res.json();
    const p = (j.predictions && j.predictions[0]) || null;
    if (!p) return { ok: true, insumo, data: [] as any[] };
    const hist = p.historico || [];
    const proy = p.proyeccion || [];
    const sCant = stddev(hist.map((h: any) => h.cantidad));
    const z = 1.28; // ~80%
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const points = hist.map((h: any) => ({
      fecha: String(h.fecha).substring(0, 7), cantidad: r2(h.cantidad),
      cantidadProy: null as number | null, banda: null as number[] | null
    }));
    if (points.length) {
      const lastC = r2(hist[hist.length - 1].cantidad);
      points[points.length - 1].cantidadProy = lastC;
      points[points.length - 1].banda = [lastC, lastC];
    }
    proy.forEach((x: any, i: number) => {
      const k = z * Math.sqrt(i + 1);
      points.push({
        fecha: String(x.fecha).substring(0, 7), cantidad: null, cantidadProy: r2(x.cantidad),
        banda: [Math.max(0, r2(x.cantidad - k * sCant)), r2(x.cantidad + k * sCant)]
      });
    });
    return { ok: true, insumo: p.insumo, data: points };
  } catch {
    return { ok: false, insumo, data: [] as any[] };
  }
}

// Riesgo de falla por zona desde /predict/mantenimiento (cruza incidentes por nivel/zona).
export async function fetchMantenimientoPrediction(nivel?: string) {
  try {
    const url = `${PREDICTIVE_URL}/predict/mantenimiento` + (nivel ? `?nivel=${encodeURIComponent(nivel)}` : '');
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { ok: false, data: [] as any[] };
    const j = await res.json();
    return { ok: true, data: (j.results || []) as any[] };
  } catch {
    return { ok: false, data: [] as any[] };
  }
}

// ===================== INGESTA MENSUAL (microservicio /ingest/*) =====================

// Parsea y valida las filas del Excel (devuelve actividades + issues + sugerencias).
export async function validarIngesta(rows: any[]) {
  try {
    const res = await fetch(`${PREDICTIVE_URL}/ingest/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, error: `Microservicio respondió ${res.status}`, activities: [] as any[], summary: null, columns: null };
    const j = await res.json();
    return { ok: true, activities: (j.activities || []) as any[], summary: j.summary, columns: j.columns };
  } catch {
    return { ok: false, error: 'Microservicio de ingesta no disponible.', activities: [] as any[], summary: null, columns: null };
  }
}

// Re-valida e inserta a Supabase las actividades incluidas. Idempotente (dedup por import_hash).
export async function confirmarIngesta(activities: any[]) {
  try {
    const res = await fetch(`${PREDICTIVE_URL}/ingest/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activities }),
      cache: 'no-store',
    });
    if (!res.ok) {
      let detail = `Microservicio respondió ${res.status}`;
      try { const j = await res.json(); if (j && j.detail) detail = String(j.detail); } catch {}
      return { ok: false, error: detail };
    }
    const j = await res.json();
    return { ok: true, inserted: j.inserted || 0, skipped: j.skipped || 0, total: j.total || 0 };
  } catch {
    return { ok: false, error: 'Microservicio de ingesta no disponible.' };
  }
}

// Exporta TODO el histórico a un .xlsx (Datos + agregaciones + PivotTables nativas) vía microservicio.
export async function exportarExcel() {
  try {
    const res = await fetch(`${PREDICTIVE_URL}/export`, { cache: 'no-store' });
    if (!res.ok) return { ok: false, error: `Microservicio respondió ${res.status}` };
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString('base64');
    return { ok: true, base64, filename: 'ERP_UM_Corona_export.xlsx' };
  } catch {
    return { ok: false, error: 'Microservicio no disponible (¿Render despierto? Reintenta en ~30 s).' };
  }
}
