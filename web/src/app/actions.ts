"use server";

import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import type { TicketParsed, InsumoConsumo } from '@/lib/excelParser';

// Lazy-load del parser Excel solo cuando se necesite
async function loadExcelData(): Promise<TicketParsed[]> {
  try {
    const { getExcelData } = await import('@/lib/excelParser');
    return getExcelData();
  } catch (e) {
    console.warn("Excel fallback no disponible:", e);
    return [];
  }
}

// Inicializar Pool de conexiones a base de datos (Supabase / Postgres)
const dbUrl = process.env.DATABASE_URL;
let pool: Pool | null = null;

if (dbUrl) {
  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('sslmode=disable');
  pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false }
  });
}

// URL del microservicio de predicción
const PREDICTIVE_URL = process.env.PREDICTIVE_API_URL || 'http://127.0.0.1:8000';
const PREDICTIVE_KEY = process.env.PREDICTIVE_API_KEY || '';
function svcHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...(extra || {}) };
  if (PREDICTIVE_KEY) h['X-API-Key'] = PREDICTIVE_KEY;
  return h;
}

// ===== Interfaces Oficiales TdR_Sistema_KPIs_Yauricocha.md =====

export type DashFilters = {
  subsistema?: string;
  tipo?: string;
  origen?: string;
  mes?: string;
};

// KPI-01: Volumen Mensual por Tipo
export interface KPI01_VolumenMensual {
  month: string;
  incidentes: number;
  requerimientos: number;
  total: number;
}

// KPI-02: Ratio de Incidencia
export interface KPI02_RatioIncidencia {
  month: string;
  incidentes: number;
  total: number;
  ratio_pct: number;
  promedio_historico: number; // 31.9%
}

// KPI-03: Distribución por Sistema
export interface KPI03_DistribucionSistema {
  codigo: string;
  nombre: string;
  total: number;
  incidentes: number;
  requerimientos: number;
  pct: number;
}

// KPI-04: Pareto de Causas Raíz
export interface KPI04_ParetoCausas {
  causa: string;
  sistema: string;
  cantidad: number;
  pct_individual: number;
  pct_acumulado: number;
}

// KPI-05: % Incidentes por Daño de Terceros
export interface KPI05_DanioTerceros {
  month: string;
  total_tickets: number;
  tickets_danio: number;
  pct_danio: number;
}

// KPI-06: Tiempo Promedio de Atención
export interface KPI06_TiempoAtencion {
  sistema: string;
  incidentes_hrs: number;
  requerimientos_hrs: number;
  promedio_general_hrs: number;
}

// KPI-07: Personas-Hora Totales
export interface KPI07_PersonasHora {
  month: string;
  hh_totales: number;
  total_tickets: number;
  hh_promedio_ticket: number;
}

// KPI-08: Top Ubicaciones
export interface KPI08_TopUbicaciones {
  ubicacion: string;
  nivel: string;
  piso: string;
  zona: string;
  total: number;
  pct: number;
}

// KPI-09: Consumo de Materiales
export interface KPI09_ConsumoMateriales {
  insumo: string;
  sku: string;
  unidad: string;
  cantidad_total: number;
  tickets_count: number;
}

// KPI-10: Costo de Materiales
export interface KPI10_CostoMateriales {
  month: string;
  DAT: number;
  CCTV: number;
  RAD: number;
  TEL: number;
  GEO: number;
  FO: number;
  WIFI: number;
  total: number;
}

export interface DashboardDataResult {
  // Resumen Ejecutivo
  totalTickets: number;
  totalIncidentes: number;
  totalRequerimientos: number;
  ratioIncidenciaGlobalPct: number;
  totalPersonasHora: number;
  promedioHHporTicket: number;
  totalCostoMateriales: number;
  
  // KPIs Oficiales del TdR (Bloques A, B y C)
  kpi01_volumenMensual: KPI01_VolumenMensual[];
  kpi02_ratioIncidencia: KPI02_RatioIncidencia[];
  kpi03_distribucionSistema: KPI03_DistribucionSistema[];
  kpi04_paretoCausas: KPI04_ParetoCausas[];
  kpi05_danioTerceros: KPI05_DanioTerceros[];
  kpi06_tiempoAtencion: KPI06_TiempoAtencion[];
  kpi07_personasHora: KPI07_PersonasHora[];
  kpi08_topUbicaciones: KPI08_TopUbicaciones[];
  kpi09_consumoMateriales: KPI09_ConsumoMateriales[];
  kpi10_costoMateriales: KPI10_CostoMateriales[];

  // Compatibilidad adicional
  source: 'supabase' | 'excel';
}

function taskMatchesFilters(t: TicketParsed, f: DashFilters): boolean {
  if (f.subsistema && t.sistema !== f.subsistema) return false;
  if (f.tipo && t.tipo_registro !== f.tipo) return false;
  if (f.origen && t.tipo_trabajo !== f.origen) return false;
  if (f.mes && !t.fecha.startsWith(f.mes)) return false;
  return true;
}

// Construye todo el Dashboard de KPIs directamente a partir de la lista de Tickets
function buildDashboardFromTickets(tickets: TicketParsed[], source: 'supabase' | 'excel'): DashboardDataResult {
  const totalTickets = tickets.length;
  let totalIncidentes = 0;
  let totalRequerimientos = 0;
  let totalPersonasHora = 0;
  let totalCostoMateriales = 0;

  // Agrupadores por Mes (YYYY-MM)
  const monthMap: { [m: string]: { incidentes: number; requerimientos: number; hh: number; danio: number; costos: { [sub: string]: number } } } = {};
  
  // Agrupadores por Sistema
  const sistemaMap: { [s: string]: { total: number; incidentes: number; requerimientos: number; duracion_inc: number[]; duracion_req: number[] } } = {
    DAT: { total: 0, incidentes: 0, requerimientos: 0, duracion_inc: [], duracion_req: [] },
    CCTV: { total: 0, incidentes: 0, requerimientos: 0, duracion_inc: [], duracion_req: [] },
    RAD: { total: 0, incidentes: 0, requerimientos: 0, duracion_inc: [], duracion_req: [] },
    TEL: { total: 0, incidentes: 0, requerimientos: 0, duracion_inc: [], duracion_req: [] },
    GEO: { total: 0, incidentes: 0, requerimientos: 0, duracion_inc: [], duracion_req: [] },
    FO: { total: 0, incidentes: 0, requerimientos: 0, duracion_inc: [], duracion_req: [] },
    WIFI: { total: 0, incidentes: 0, requerimientos: 0, duracion_inc: [], duracion_req: [] },
  };

  // Agrupadores por Causa Raíz
  const causaMap: { [c: string]: { count: number; sistema: string } } = {};

  // Agrupadores por Ubicación
  const ubicacionMap: { [u: string]: { nivel: string; piso: string; zona: string; count: number } } = {};

  // Agrupadores por Insumo
  const insumoMap: { [name: string]: { sku: string; unidad: string; cantidad: number; count: number } } = {};

  tickets.forEach(t => {
    const isInc = t.tipo_registro === 'Incidente';
    if (isInc) totalIncidentes++; else totalRequerimientos++;

    const hh = t.horas_hombre || (t.cantidad_personal * t.duracion_horas);
    totalPersonasHora += hh;

    const month = t.fecha ? t.fecha.substring(0, 7) : '2025-07';
    if (!monthMap[month]) {
      monthMap[month] = {
        incidentes: 0,
        requerimientos: 0,
        hh: 0,
        danio: 0,
        costos: { DAT: 0, CCTV: 0, RAD: 0, TEL: 0, GEO: 0, FO: 0, WIFI: 0 }
      };
    }
    if (isInc) monthMap[month].incidentes++; else monthMap[month].requerimientos++;
    monthMap[month].hh += hh;

    if (t.causa_raiz.toLowerCase().includes('cable roto por trabajos')) {
      monthMap[month].danio++;
    }

    // Sistema
    const sub = t.sistema || 'DAT';
    if (sistemaMap[sub]) {
      sistemaMap[sub].total++;
      if (isInc) {
        sistemaMap[sub].incidentes++;
        sistemaMap[sub].duracion_inc.push(t.duracion_horas);
      } else {
        sistemaMap[sub].requerimientos++;
        sistemaMap[sub].duracion_req.push(t.duracion_horas);
      }
    }

    // Causa Raíz
    const causa = t.causa_raiz || 'Mantenimiento Programado';
    if (!causaMap[causa]) causaMap[causa] = { count: 0, sistema: sub };
    causaMap[causa].count++;

    // Ubicación
    const uNorm = t.ubicacion.nombre_normalizado || `${t.ubicacion.nivel} ${t.ubicacion.piso} ${t.ubicacion.zona}`;
    if (!ubicacionMap[uNorm]) {
      ubicacionMap[uNorm] = {
        nivel: t.ubicacion.nivel,
        piso: t.ubicacion.piso,
        zona: t.ubicacion.zona,
        count: 0
      };
    }
    ubicacionMap[uNorm].count++;

    // Insumos
    t.insumos.forEach(ins => {
      totalCostoMateriales += ins.costo_total;
      monthMap[month].costos[sub] = (monthMap[month].costos[sub] || 0) + ins.costo_total;

      if (!insumoMap[ins.name]) {
        insumoMap[ins.name] = {
          sku: ins.sku,
          unidad: ins.unidad,
          cantidad: 0,
          count: 0
        };
      }
      insumoMap[ins.name].cantidad += ins.cantidad;
      insumoMap[ins.name].count++;
    });
  });

  // KPI-01: Volumen Mensual
  const sortedMonths = Object.keys(monthMap).sort();
  const kpi01_volumenMensual: KPI01_VolumenMensual[] = sortedMonths.map(m => ({
    month: m,
    incidentes: monthMap[m].incidentes,
    requerimientos: monthMap[m].requerimientos,
    total: monthMap[m].incidentes + monthMap[m].requerimientos
  }));

  // KPI-02: Ratio de Incidencia
  const kpi02_ratioIncidencia: KPI02_RatioIncidencia[] = sortedMonths.map(m => {
    const tot = monthMap[m].incidentes + monthMap[m].requerimientos;
    const ratio = tot > 0 ? Math.round((monthMap[m].incidentes / tot) * 10000) / 100 : 0;
    return {
      month: m,
      incidentes: monthMap[m].incidentes,
      total: tot,
      ratio_pct: ratio,
      promedio_historico: 31.9
    };
  });

  // KPI-03: Distribución por Sistema
  const nombresSistemas: { [code: string]: string } = {
    DAT: 'Red de Datos',
    CCTV: 'Circuito Cerrado de TV',
    RAD: 'Radiocomunicaciones',
    TEL: 'Telefonía e Intercomunicación',
    GEO: 'Geomecánica y Sensores',
    FO: 'Fibra Óptica Primaria',
    WIFI: 'Red Inalámbrica WiFi'
  };
  const kpi03_distribucionSistema: KPI03_DistribucionSistema[] = Object.keys(sistemaMap)
    .map(code => {
      const s = sistemaMap[code];
      const pct = totalTickets > 0 ? Math.round((s.total / totalTickets) * 10000) / 100 : 0;
      return {
        codigo: code,
        nombre: nombresSistemas[code] || code,
        total: s.total,
        incidentes: s.incidentes,
        requerimientos: s.requerimientos,
        pct
      };
    })
    .sort((a, b) => b.total - a.total);

  // KPI-04: Pareto de Causas Raíz
  const causaSorted = Object.entries(causaMap)
    .map(([causa, meta]) => ({ causa, sistema: meta.sistema, cantidad: meta.count }))
    .sort((a, b) => b.cantidad - a.cantidad);
  
  let accPareto = 0;
  const kpi04_paretoCausas: KPI04_ParetoCausas[] = causaSorted.map(c => {
    accPareto += c.cantidad;
    const pctInd = totalTickets > 0 ? Math.round((c.cantidad / totalTickets) * 10000) / 100 : 0;
    const pctAcum = totalTickets > 0 ? Math.round((accPareto / totalTickets) * 10000) / 100 : 0;
    return {
      causa: c.causa,
      sistema: c.sistema,
      cantidad: c.cantidad,
      pct_individual: pctInd,
      pct_acumulado: pctAcum
    };
  });

  // KPI-05: Daño de Terceros
  const kpi05_danioTerceros: KPI05_DanioTerceros[] = sortedMonths.map(m => {
    const tot = monthMap[m].incidentes + monthMap[m].requerimientos;
    const danio = monthMap[m].danio;
    const pct = tot > 0 ? Math.round((danio / tot) * 10000) / 100 : 0;
    return {
      month: m,
      total_tickets: tot,
      tickets_danio: danio,
      pct_danio: pct
    };
  });

  // KPI-06: Tiempo Promedio de Atención
  const kpi06_tiempoAtencion: KPI06_TiempoAtencion[] = Object.keys(sistemaMap).map(code => {
    const s = sistemaMap[code];
    const avgInc = s.duracion_inc.length > 0 ? s.duracion_inc.reduce((a, b) => a + b, 0) / s.duracion_inc.length : 0;
    const avgReq = s.duracion_req.length > 0 ? s.duracion_req.reduce((a, b) => a + b, 0) / s.duracion_req.length : 0;
    const allDur = [...s.duracion_inc, ...s.duracion_req];
    const avgGen = allDur.length > 0 ? allDur.reduce((a, b) => a + b, 0) / allDur.length : 0;
    return {
      sistema: code,
      incidentes_hrs: Math.round(avgInc * 100) / 100,
      requerimientos_hrs: Math.round(avgReq * 100) / 100,
      promedio_general_hrs: Math.round(avgGen * 100) / 100
    };
  });

  // KPI-07: Personas-Hora Totales por Mes
  const kpi07_personasHora: KPI07_PersonasHora[] = sortedMonths.map(m => {
    const tot = monthMap[m].incidentes + monthMap[m].requerimientos;
    const hh = Math.round(monthMap[m].hh * 10) / 10;
    const avg = tot > 0 ? Math.round((hh / tot) * 100) / 100 : 0;
    return {
      month: m,
      hh_totales: hh,
      total_tickets: tot,
      hh_promedio_ticket: avg
    };
  });

  // KPI-08: Top Ubicaciones (Top 15)
  const kpi08_topUbicaciones: KPI08_TopUbicaciones[] = Object.entries(ubicacionMap)
    .map(([uNorm, meta]) => ({
      ubicacion: uNorm,
      nivel: meta.nivel,
      piso: meta.piso,
      zona: meta.zona,
      total: meta.count,
      pct: totalTickets > 0 ? Math.round((meta.count / totalTickets) * 10000) / 100 : 0
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  // KPI-09: Consumo de Materiales (Top Insumos)
  const kpi09_consumoMateriales: KPI09_ConsumoMateriales[] = Object.entries(insumoMap)
    .map(([name, meta]) => ({
      insumo: name,
      sku: meta.sku,
      unidad: meta.unidad,
      cantidad_total: Math.round(meta.cantidad * 100) / 100,
      tickets_count: meta.count
    }))
    .sort((a, b) => b.cantidad_total - a.cantidad_total);

  // KPI-10: Costo de Materiales por Mes y Sistema
  const kpi10_costoMateriales: KPI10_CostoMateriales[] = sortedMonths.map(m => {
    const c = monthMap[m].costos;
    const dat = Math.round((c.DAT || 0) * 100) / 100;
    const cctv = Math.round((c.CCTV || 0) * 100) / 100;
    const rad = Math.round((c.RAD || 0) * 100) / 100;
    const tel = Math.round((c.TEL || 0) * 100) / 100;
    const geo = Math.round((c.GEO || 0) * 100) / 100;
    const fo = Math.round((c.FO || 0) * 100) / 100;
    const wifi = Math.round((c.WIFI || 0) * 100) / 100;
    const tot = Math.round((dat + cctv + rad + tel + geo + fo + wifi) * 100) / 100;
    return {
      month: m,
      DAT: dat,
      CCTV: cctv,
      RAD: rad,
      TEL: tel,
      GEO: geo,
      FO: fo,
      WIFI: wifi,
      total: tot
    };
  });

  const ratioGlobal = totalTickets > 0 ? Math.round((totalIncidentes / totalTickets) * 10000) / 100 : 0;
  const promHH = totalTickets > 0 ? Math.round((totalPersonasHora / totalTickets) * 100) / 100 : 0;

  return {
    totalTickets,
    totalIncidentes,
    totalRequerimientos,
    ratioIncidenciaGlobalPct: ratioGlobal,
    totalPersonasHora: Math.round(totalPersonasHora),
    promedioHHporTicket: promHH,
    totalCostoMateriales: Math.round(totalCostoMateriales * 100) / 100,

    kpi01_volumenMensual,
    kpi02_ratioIncidencia,
    kpi03_distribucionSistema,
    kpi04_paretoCausas,
    kpi05_danioTerceros,
    kpi06_tiempoAtencion,
    kpi07_personasHora,
    kpi08_topUbicaciones,
    kpi09_consumoMateriales,
    kpi10_costoMateriales,

    source
  };
}

export async function fetchDashboardData(filters: DashFilters = {}): Promise<DashboardDataResult> {
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        const where: string[] = [];
        const params: any[] = [];
        let pi = 1;

        if (filters.tipo) { where.push(`t.tipo_registro = $${pi++}`); params.push(filters.tipo); }
        if (filters.origen) { where.push(`t.tipo_trabajo = $${pi++}`); params.push(filters.origen); }
        if (filters.subsistema) { where.push(`s.codigo = $${pi++}`); params.push(filters.subsistema); }
        if (filters.mes) { where.push(`to_char(t.fecha, 'YYYY-MM') = $${pi++}`); params.push(filters.mes); }

        const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

        const ticketsRes = await client.query(`
          SELECT 
            t.ticket_id,
            t.codigo_registro,
            to_char(t.fecha, 'YYYY-MM-DD') AS fecha,
            t.tipo_registro,
            t.tipo_trabajo,
            t.cantidad_personal,
            t.duracion_horas::float,
            (t.cantidad_personal * t.duracion_horas)::float AS horas_hombre,
            t.descripcion_corta,
            t.trabajo_realizado,
            t.estado,
            COALESCE(um.nombre, 'UM Corona') AS unidad_minera,
            COALESCE(m.nombre, 'Yauricocha') AS mina,
            COALESCE(a.nombre, 'Infraestructura') AS area,
            COALESCE(u.nivel, 'NV 1170') AS nivel,
            COALESCE(u.piso, 'P-1') AS piso,
            COALESCE(u.zona, 'General') AS zona,
            COALESCE(u.nombre_normalizado, 'NV 1170 P-1 General') AS nombre_normalizado,
            COALESCE(cr.categoria, 'Mantenimiento Programado') AS causa_raiz,
            COALESCE(s.codigo, 'DAT') AS sistema
          FROM ticket t
          LEFT JOIN mina m ON t.mina_id = m.mina_id
          LEFT JOIN unidad_minera um ON m.unidad_minera_id = um.unidad_minera_id
          LEFT JOIN area a ON t.area_id = a.area_id
          LEFT JOIN ubicacion u ON t.ubicacion_id = u.ubicacion_id
          LEFT JOIN causa_raiz cr ON t.causa_raiz_id = cr.causa_raiz_id
          LEFT JOIN sistema s ON cr.sistema_id = s.sistema_id
          ${whereSql}
          ORDER BY t.fecha ASC
        `, params);

        const insumosRes = await client.query(`
          SELECT 
            ti.ticket_id,
            ic.nombre AS name,
            ic.codigo_sku AS sku,
            ti.cantidad::float AS cantidad,
            ic.unidad_medida AS unidad,
            ic.precio_unitario::float AS precio_unitario,
            (ti.cantidad * ic.precio_unitario)::float AS costo_total
          FROM ticket_insumo ti
          JOIN insumo_catalogo ic ON ti.insumo_id = ic.insumo_id
        `);

        const insByTicket: { [id: number]: InsumoConsumo[] } = {};
        insumosRes.rows.forEach((r: any) => {
          if (!insByTicket[r.ticket_id]) insByTicket[r.ticket_id] = [];
          insByTicket[r.ticket_id].push({
            name: r.name,
            sku: r.sku || 'GEN-SKU-001',
            cantidad: r.cantidad,
            unidad: r.unidad || 'UN',
            precio_unitario: r.precio_unitario || 0.0,
            costo_total: r.costo_total || 0.0,
            esLineaSeparada: false
          });
        });

        const tickets: TicketParsed[] = ticketsRes.rows.map((r: any) => ({
          ticket_id: String(r.ticket_id),
          codigo_registro: r.codigo_registro,
          fecha: r.fecha,
          tipo_registro: r.tipo_registro,
          tipo_trabajo: r.tipo_trabajo,
          cantidad_personal: r.cantidad_personal,
          duracion_horas: r.duracion_horas,
          horas_hombre: r.horas_hombre,
          descripcion_corta: r.descripcion_corta,
          trabajo_realizado: r.trabajo_realizado,
          estado: r.estado,
          unidad_minera: r.unidad_minera,
          mina: r.mina,
          area: r.area,
          ubicacion: {
            nivel: r.nivel,
            piso: r.piso,
            zona: r.zona,
            nombre_normalizado: r.nombre_normalizado,
            texto_original: `${r.nivel} ${r.piso} ${r.zona}`
          },
          causa_raiz: r.causa_raiz,
          sistema: r.sistema as any,
          insumos: insByTicket[r.ticket_id] || []
        }));

        return buildDashboardFromTickets(tickets, 'supabase');
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error al consultar Supabase, reintentando con Excel local:", error);
    }
  }

  // --- FALLBACK EXCEL LOCAL ---
  const rawTickets = await loadExcelData();
  const filteredTickets = rawTickets.filter(t => taskMatchesFilters(t, filters));
  return buildDashboardFromTickets(filteredTickets, 'excel');
}

export async function fetchTasks(page = 1, limit = 50, search = '', typeFilter = '', originFilter = '') {
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        let whereClauses: string[] = [];
        let params: any[] = [];
        let pIdx = 1;

        if (typeFilter) {
          whereClauses.push(`t.tipo_registro = $${pIdx++}`);
          params.push(typeFilter);
        }
        if (originFilter) {
          whereClauses.push(`t.tipo_trabajo = $${pIdx++}`);
          params.push(originFilter);
        }
        if (search) {
          whereClauses.push(`(t.codigo_registro ILIKE $${pIdx} OR u.nombre_normalizado ILIKE $${pIdx} OR cr.categoria ILIKE $${pIdx} OR t.descripcion_corta ILIKE $${pIdx})`);
          params.push(`%${search}%`);
          pIdx++;
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const offset = (page - 1) * limit;

        const countRes = await client.query(`
          SELECT COUNT(*)::int AS total
          FROM ticket t
          LEFT JOIN ubicacion u ON t.ubicacion_id = u.ubicacion_id
          LEFT JOIN causa_raiz cr ON t.causa_raiz_id = cr.causa_raiz_id
          ${whereSql}
        `, params);

        const tasksRes = await client.query(`
          SELECT 
            t.ticket_id,
            t.codigo_registro,
            to_char(t.fecha, 'YYYY-MM-DD') AS fecha,
            t.tipo_registro,
            t.tipo_trabajo,
            t.cantidad_personal,
            t.duracion_horas::float,
            (t.cantidad_personal * t.duracion_horas)::float AS horas_hombre,
            t.descripcion_corta,
            t.trabajo_realizado,
            COALESCE(u.nombre_normalizado, 'NV 1170 General') AS ubicacion,
            COALESCE(cr.categoria, 'Mantenimiento Programado') AS causa_raiz,
            COALESCE(s.codigo, 'DAT') AS sistema
          FROM ticket t
          LEFT JOIN ubicacion u ON t.ubicacion_id = u.ubicacion_id
          LEFT JOIN causa_raiz cr ON t.causa_raiz_id = cr.causa_raiz_id
          LEFT JOIN sistema s ON cr.sistema_id = s.sistema_id
          ${whereSql}
          ORDER BY t.fecha DESC
          LIMIT $${pIdx++} OFFSET $${pIdx++}
        `, [...params, limit, offset]);

        return {
          tasks: tasksRes.rows,
          total: countRes.rows[0].total,
          page,
          totalPages: Math.ceil(countRes.rows[0].total / limit)
        };
      } finally {
        client.release();
      }
    } catch (e) {
      console.error("Error fetching tasks from DB:", e);
    }
  }

  // --- FALLBACK EXCEL LOCAL ---
  const allTickets = await loadExcelData();
  let filtered = allTickets;

  if (typeFilter) filtered = filtered.filter(t => t.tipo_registro === typeFilter);
  if (originFilter) filtered = filtered.filter(t => t.tipo_trabajo === originFilter);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(t => 
      t.codigo_registro.toLowerCase().includes(q) ||
      t.ubicacion.nombre_normalizado.toLowerCase().includes(q) ||
      t.causa_raiz.toLowerCase().includes(q) ||
      (t.descripcion_corta && t.descripcion_corta.toLowerCase().includes(q))
    );
  }

  const total = filtered.length;
  const startIndex = (page - 1) * limit;
  const pageTasks = filtered.slice(startIndex, startIndex + limit).map(t => ({
    ticket_id: t.ticket_id,
    codigo_registro: t.codigo_registro,
    fecha: t.fecha,
    tipo_registro: t.tipo_registro,
    tipo_trabajo: t.tipo_trabajo,
    cantidad_personal: t.cantidad_personal,
    duracion_horas: t.duracion_horas,
    horas_hombre: t.horas_hombre,
    descripcion_corta: t.descripcion_corta,
    trabajo_realizado: t.trabajo_realizado,
    ubicacion: t.ubicacion.nombre_normalizado,
    causa_raiz: t.causa_raiz,
    sistema: t.sistema
  }));

  return {
    tasks: pageTasks,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

export async function exportarExcel() {
  try {
    const rawTickets = await loadExcelData();
    const worksheet = XLSX.utils.json_to_sheet(rawTickets.map(t => ({
      'Código Registro': t.codigo_registro,
      'Fecha': t.fecha,
      'Tipo Registro': t.tipo_registro,
      'Tipo Trabajo': t.tipo_trabajo,
      'Mina': t.mina,
      'Área': t.area,
      'Ubicación': t.ubicacion.nombre_normalizado,
      'Sistema': t.sistema,
      'Causa Raíz': t.causa_raiz,
      'Personal': t.cantidad_personal,
      'Tiempo (h)': t.duracion_horas,
      'Horas Hombre (hh)': t.horas_hombre,
      'Detalle': t.descripcion_corta || '',
      'Trabajo Realizado': t.trabajo_realizado || ''
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets Yauricocha');
    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const base64 = buf.toString('base64');
    return { ok: true, base64, filename: 'Yauricocha_Tickets_KPI.xlsx' };
  } catch (error) {
    console.error("Error exportando a Excel:", error);
    return { ok: false, error: 'Error al generar el archivo Excel.' };
  }
}

export async function fetchIngestHistory() {
  return [
    {
      id: 'ing-001',
      archivo: 'Yauricocha - CORONA.xlsx',
      registros: 2741,
      fecha: '2026-07-26T08:00:00Z',
      estado: 'COMPLETADO',
      usuario: 'Sistema Admin'
    }
  ];
}
