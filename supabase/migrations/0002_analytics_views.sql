-- =====================================================================
-- Migración 0002: Vistas analíticas de productividad, carga y mermas
-- ---------------------------------------------------------------------
-- Materializa el aprovechamiento del campo `tiempo` como recurso:
--   * Horas-Hombre (HH = cant_personas * tiempo_horas)  -> RF-11
--   * Productividad por Causa Raíz y por Nivel          -> RF-11/RF-16
--   * Mermas: intensidad de consumo de insumo por HH    -> RF-09
--   * Carga de trabajo mensual (base de predicción)     -> RF-18
--   * Jerarquía Causa Raíz -> Detalle (drill-down)
-- Consumidas por web/src/app/actions.ts (ruta Supabase) y por el
-- microservicio de predicción (predictive/app/main.py).
-- =====================================================================

-- Vista base general: una fila por tarea con sus dimensiones y HH.
-- Sirve de cimiento para las demás y para análisis ad-hoc / predicción.
CREATE OR REPLACE VIEW vw_productividad AS
SELECT
    t.id,
    t.unidad_minera_id,
    to_char(t.periodo, 'YYYY-MM')                     AS periodo,
    cr.nombre                                         AS causa_raiz,
    cs.codigo                                         AS subsistema,
    u.nivel                                           AS nivel,
    u.zona                                            AS zona,
    ct.nombre                                         AS tipo,
    t.cant_personas,
    t.tiempo_horas,
    (COALESCE(t.cant_personas, 0) * COALESCE(t.tiempo_horas, 0)) AS horas_hombre
FROM tarea t
JOIN cat_tipo ct        ON t.tipo_id = ct.id
LEFT JOIN cat_causa_raiz cr ON t.causa_raiz_id = cr.id
LEFT JOIN cat_subsistema cs ON cr.subsistema_id = cs.id
LEFT JOIN ubicacion u       ON t.ubicacion_id = u.id;

-- (2) Productividad por Causa Raíz
CREATE OR REPLACE VIEW vw_productividad_causa AS
SELECT
    COALESCE(causa_raiz, 'Sin causa') AS name,
    COUNT(*)::int                     AS tareas,
    COALESCE(SUM(tiempo_horas), 0)::float AS horas,
    COALESCE(SUM(horas_hombre), 0)::float AS hh
FROM vw_productividad
GROUP BY COALESCE(causa_raiz, 'Sin causa');

-- (2) Productividad por Nivel (desglose de Ubicación: NV.xxxx, Superficie, etc.)
CREATE OR REPLACE VIEW vw_productividad_nivel AS
SELECT
    COALESCE(nivel, 'Interior Mina') AS name,
    COUNT(*)::int                    AS tareas,
    COALESCE(SUM(tiempo_horas), 0)::float AS horas,
    COALESCE(SUM(horas_hombre), 0)::float AS hh
FROM vw_productividad
GROUP BY COALESCE(nivel, 'Interior Mina');

-- (3) Carga de trabajo mensual: HH y nº de tareas por periodo.
CREATE OR REPLACE VIEW vw_carga_mensual AS
SELECT
    periodo AS month,           -- vw_productividad.periodo ya viene como 'YYYY-MM'
    COALESCE(SUM(horas_hombre), 0)::float AS hh,
    COUNT(*)::int               AS tareas
FROM vw_productividad
WHERE periodo IS NOT NULL
GROUP BY periodo;

-- (4) Mermas: consumo total de cada insumo y el esfuerzo (HH) de las
-- actividades que lo consumieron. La intensidad (cantidad/hh) se calcula
-- en la consulta para poder ordenar/filtrar de forma flexible.
CREATE OR REPLACE VIEW vw_mermas AS
SELECT
    i.nombre_normalizado AS name,
    COALESCE(SUM(ti.cantidad), 0)::float AS cantidad,
    COALESCE(SUM(COALESCE(t.cant_personas, 0) * COALESCE(t.tiempo_horas, 0)), 0)::float AS hh
FROM tarea_insumo ti
JOIN tarea t   ON ti.tarea_id = t.id
JOIN insumo i  ON ti.insumo_id = i.id
GROUP BY i.nombre_normalizado;

-- (5) Jerarquía Causa Raíz -> Detalle (drill-down).
CREATE OR REPLACE VIEW vw_causa_detalle AS
SELECT
    cr.nombre AS causa,
    COALESCE(NULLIF(TRIM(t.detalle), ''), '(sin detalle)') AS detalle,
    COUNT(*)::int AS value
FROM tarea t
JOIN cat_causa_raiz cr ON t.causa_raiz_id = cr.id
GROUP BY cr.nombre, COALESCE(NULLIF(TRIM(t.detalle), ''), '(sin detalle)');
