"use server";

import { Pool } from 'pg';
import { getExcelData, TareaParsed } from '@/lib/excelParser';

// Inicializar Pool de conexiones a base de datos (Supabase) si la URL está presente
const dbUrl = process.env.DATABASE_URL;
let pool: Pool | null = null;

if (dbUrl) {
  pool = new Pool({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false // Requerido para conexiones seguras en Supabase
    }
  });
}

export async function fetchDashboardData() {
  if (pool) {
    try {
      const client = await pool.connect();
      
      // 1. Métricas básicas
      const statsRes = await client.query(`
        SELECT 
          COUNT(*)::int as total_tasks,
          AVG(cant_personas)::float as avg_person,
          AVG(tiempo_horas)::float as avg_hours
        FROM tarea
      `);
      
      const insumosQtyRes = await client.query(`
        SELECT SUM(cantidad)::float as total_insumos_qty FROM tarea_insumo
      `);

      // 2. Top 8 Insumos
      const topInsumosRes = await client.query(`
        SELECT i.nombre_normalizado as name, SUM(ti.cantidad)::float as value
        FROM tarea_insumo ti
        JOIN insumo i ON ti.insumo_id = i.id
        GROUP BY i.nombre_normalizado
        ORDER BY value DESC
        LIMIT 8
      `);

      // 3. Tareas por Subsistema
      const subsistemasRes = await client.query(`
        SELECT cs.codigo as name, COUNT(*)::int as value
        FROM tarea t
        JOIN cat_causa_raiz cr ON t.causa_raiz_id = cr.id
        JOIN cat_subsistema cs ON cr.subsistema_id = cs.id
        GROUP BY cs.codigo
        ORDER BY value DESC
      `);

      // 4. Zonas Calientes (Ubicaciones)
      const topLocationsRes = await client.query(`
        SELECT (u.nivel || ' > ' || u.zona) as name, COUNT(*)::int as value
        FROM tarea t
        JOIN ubicacion u ON t.ubicacion_id = u.id
        GROUP BY u.nivel, u.zona
        ORDER BY value DESC
        LIMIT 6
      `);

      // 5. Tendencia Mensual
      const monthlyTrendRes = await client.query(`
        SELECT to_char(t.periodo, 'YYYY-MM') as month,
               COUNT(CASE WHEN ct.nombre = 'Incidente' THEN 1 END)::int as incidentes,
               COUNT(CASE WHEN ct.nombre = 'Requerimiento' THEN 1 END)::int as requerimientos,
               COUNT(*)::int as total
        FROM tarea t
        JOIN cat_tipo ct ON t.tipo_id = ct.id
        WHERE t.periodo IS NOT NULL
        GROUP BY to_char(t.periodo, 'YYYY-MM')
        ORDER BY month ASC
      `);

      // 6. Distribución de Origen
      const originRes = await client.query(`
        SELECT co.nombre as name, COUNT(*)::int as value
        FROM tarea t
        JOIN cat_origen co ON t.origen_id = co.id
        GROUP BY co.nombre
      `);

      // 7. Distribución de Tipo
      const tipoRes = await client.query(`
        SELECT ct.nombre as name, COUNT(*)::int as value
        FROM tarea t
        JOIN cat_tipo ct ON t.tipo_id = ct.id
        GROUP BY ct.nombre
      `);

      client.release();

      const stats = statsRes.rows[0];
      const insumosQty = insumosQtyRes.rows[0].total_insumos_qty || 0;

      return {
        totalTasks: stats.total_tasks,
        totalInsumosQty: Math.round(insumosQty),
        avgPerson: Math.round((stats.avg_person || 0) * 10) / 10,
        avgHours: Math.round((stats.avg_hours || 0) * 10) / 10,
        topInsumos: topInsumosRes.rows,
        subsistemas: subsistemasRes.rows,
        topLocations: topLocationsRes.rows,
        monthlyTrend: monthlyTrendRes.rows,
        originDistribution: originRes.rows,
        tipoDistribution: tipoRes.rows
      };

    } catch (error) {
      console.error("Error al consultar Supabase, reintentando con Excel local:", error);
      // Fallback a Excel local en caso de error de conexión
    }
  }

  // --- FALLBACK EXCEL LOCAL ---
  const data = getExcelData();
  const totalTasks = data.length;
  
  if (totalTasks === 0) {
    return {
      totalTasks: 0,
      totalInsumosQty: 0,
      avgPerson: 0,
      avgHours: 0,
      topInsumos: [],
      subsistemas: [],
      topLocations: [],
      monthlyTrend: [],
      originDistribution: [],
      tipoDistribution: []
    };
  }

  let totalInsumosQty = 0;
  const insumosCountMap: { [key: string]: number } = {};
  const subsistemaCountMap: { [key: string]: number } = {};
  const originCountMap: { [key: string]: number } = { IM: 0, SUP: 0 };
  const tipoCountMap: { [key: string]: number } = { Incidente: 0, Requerimiento: 0 };
  
  let totalPerson = 0;
  let totalHours = 0;
  
  const periodMap: { [key: string]: { incidentes: number, requerimientos: number } } = {};
  const locationFaultsMap: { [key: string]: number } = {};
  
  data.forEach(t => {
    totalPerson += t.cant_personas || 0;
    totalHours += t.tiempo_horas || 0;
    
    const causeClean = t.causa_raiz || 'Mantenimiento Programado';
    const subMatch = causeClean.match(/\(([A-Za-z\-]+)\)/);
    let subCode = subMatch ? subMatch[1].toUpperCase() : 'DAT';
    if (subCode === 'WI-FI') subCode = 'WIFI';
    
    subsistemaCountMap[subCode] = (subsistemaCountMap[subCode] || 0) + 1;
    
    if (t.origen === 'SUP') {
      originCountMap.SUP++;
    } else {
      originCountMap.IM++;
    }
    
    if (t.tipo === 'Incidente') {
      tipoCountMap.Incidente++;
    } else {
      tipoCountMap.Requerimiento++;
    }
    
    const locName = `${t.ubicacion.nivel} > ${t.ubicacion.zona}`;
    locationFaultsMap[locName] = (locationFaultsMap[locName] || 0) + 1;
    
    if (t.periodo) {
      const month = t.periodo.substring(0, 7);
      if (!periodMap[month]) {
        periodMap[month] = { incidentes: 0, requerimientos: 0 };
      }
      if (t.tipo === 'Incidente') {
        periodMap[month].incidentes++;
      } else {
        periodMap[month].requerimientos++;
      }
    }
    
    t.insumos.forEach(ins => {
      totalInsumosQty += ins.cantidad;
      insumosCountMap[ins.name] = (insumosCountMap[ins.name] || 0) + ins.cantidad;
    });
  });
  
  const topInsumos = Object.entries(insumosCountMap)
    .map(([name, val]) => ({ name, value: Math.round(val * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
    
  const subsistemas = Object.entries(subsistemaCountMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
    
  const topLocations = Object.entries(locationFaultsMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
    
  const monthlyTrend = Object.entries(periodMap)
    .map(([month, val]) => ({
      month,
      incidentes: val.incidentes,
      requerimientos: val.requerimientos,
      total: val.incidentes + val.requerimientos
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    totalTasks,
    totalInsumosQty: Math.round(totalInsumosQty),
    avgPerson: Math.round((totalPerson / totalTasks) * 10) / 10,
    avgHours: Math.round((totalHours / totalTasks) * 10) / 10,
    topInsumos,
    subsistemas,
    topLocations,
    monthlyTrend,
    originDistribution: [
      { name: 'Interior Mina', value: originCountMap.IM },
      { name: 'Superficie', value: originCountMap.SUP }
    ],
    tipoDistribution: [
      { name: 'Incidentes', value: tipoCountMap.Incidente },
      { name: 'Requerimientos', value: tipoCountMap.Requerimiento }
    ]
  };
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
  const data = getExcelData();
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
