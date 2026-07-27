-- =====================================================================
-- Migración 0004: Modelo de Datos Normalizado TdR Yauricocha & Vistas KPIs
-- ---------------------------------------------------------------------
-- Fuente exclusiva: TdR_Sistema_KPIs_Yauricocha.md (Secciones 5 y 7)
-- =====================================================================

-- 1. Catálogos Organizacionales
CREATE TABLE IF NOT EXISTS unidad_minera (
    unidad_minera_id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS mina (
    mina_id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    unidad_minera_id INT REFERENCES unidad_minera(unidad_minera_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS area (
    area_id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE
);

-- 2. Catálogo de Ubicaciones Normalizado
CREATE TABLE IF NOT EXISTS ubicacion (
    ubicacion_id SERIAL PRIMARY KEY,
    nivel VARCHAR(100),
    piso VARCHAR(50),
    zona VARCHAR(255),
    nombre_normalizado VARCHAR(255) UNIQUE NOT NULL,
    mina_id INT REFERENCES mina(mina_id) ON DELETE SET NULL
);

-- 3. Catálogos Maestros de Negocio
CREATE TABLE IF NOT EXISTS sistema (
    sistema_id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL, -- DAT, CCTV, RAD, TEL, GEO, FO, WIFI
    nombre VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS causa_raiz (
    causa_raiz_id SERIAL PRIMARY KEY,
    categoria VARCHAR(255) NOT NULL,
    naturaleza VARCHAR(100) DEFAULT 'Correctivo', -- Preventivo, Correctivo, Instalación, Externa, Baja
    sistema_id INT REFERENCES sistema(sistema_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS insumo_catalogo (
    insumo_id SERIAL PRIMARY KEY,
    codigo_sku VARCHAR(100) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    unidad_medida VARCHAR(50) NOT NULL DEFAULT 'UN',
    precio_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    categoria VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS usuario (
    usuario_id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(255) NOT NULL,
    rol VARCHAR(100) DEFAULT 'Técnico'
);

-- 4. Entidad Transaccional Principal: Ticket
CREATE TABLE IF NOT EXISTS ticket (
    ticket_id SERIAL PRIMARY KEY,
    codigo_registro VARCHAR(50) UNIQUE NOT NULL, -- e.g. "Registro 1"
    fecha DATE NOT NULL,
    tipo_registro VARCHAR(50) NOT NULL CHECK (tipo_registro IN ('Incidente', 'Requerimiento')),
    tipo_trabajo VARCHAR(50) NOT NULL CHECK (tipo_trabajo IN ('IM', 'SUP')),
    cantidad_personal SMALLINT NOT NULL DEFAULT 1 CHECK (cantidad_personal >= 0),
    duracion_horas NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (duracion_horas >= 0),
    descripcion_corta VARCHAR(255),
    trabajo_realizado TEXT,
    estado VARCHAR(50) NOT NULL DEFAULT 'Cerrado' CHECK (estado IN ('Abierto', 'Cerrado')),
    mina_id INT REFERENCES mina(mina_id) ON DELETE SET NULL,
    area_id INT REFERENCES area(area_id) ON DELETE SET NULL,
    ubicacion_id INT REFERENCES ubicacion(ubicacion_id) ON DELETE SET NULL,
    causa_raiz_id INT REFERENCES causa_raiz(causa_raiz_id) ON DELETE SET NULL,
    creado_por INT REFERENCES usuario(usuario_id) ON DELETE SET NULL,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabla Puente: Consumo de Insumos por Ticket
CREATE TABLE IF NOT EXISTS ticket_insumo (
    ticket_insumo_id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES ticket(ticket_id) ON DELETE CASCADE,
    insumo_id INT NOT NULL REFERENCES insumo_catalogo(insumo_id) ON DELETE RESTRICT,
    cantidad NUMERIC(10, 2) NOT NULL CHECK (cantidad > 0)
);

-- =====================================================================
-- VISTAS ANALÍTICAS (CATÁLOGO DE KPIs - SECCIÓN 7 TdR)
-- =====================================================================

-- KPI-01: Volumen mensual de tickets por tipo
CREATE OR REPLACE VIEW vw_kpi01_volumen_mensual AS
SELECT 
    to_char(fecha, 'YYYY-MM') AS mes,
    tipo_registro,
    COUNT(ticket_id)::int AS total_tickets
FROM ticket
GROUP BY to_char(fecha, 'YYYY-MM'), tipo_registro
ORDER BY mes ASC;

-- KPI-02: Ratio de incidencia (% de Incidentes por mes)
CREATE OR REPLACE VIEW vw_kpi02_ratio_incidencia AS
SELECT 
    to_char(fecha, 'YYYY-MM') AS mes,
    COUNT(ticket_id)::int AS total_tickets,
    COUNT(CASE WHEN tipo_registro = 'Incidente' THEN 1 END)::int AS incidentes,
    COUNT(CASE WHEN tipo_registro = 'Requerimiento' THEN 1 END)::int AS requerimientos,
    ROUND((COUNT(CASE WHEN tipo_registro = 'Incidente' THEN 1 END)::numeric / NULLIF(COUNT(ticket_id), 0) * 100), 2) AS ratio_incidencia_pct,
    31.9 AS promedio_historico_pct
FROM ticket
GROUP BY to_char(fecha, 'YYYY-MM')
ORDER BY mes ASC;

-- KPI-03: Distribución de tickets por sistema
CREATE OR REPLACE VIEW vw_kpi03_distribucion_sistema AS
SELECT 
    COALESCE(s.codigo, 'SIN_SISTEMA') AS codigo_sistema,
    COALESCE(s.nombre, 'Sin Sistema Asociado') AS nombre_sistema,
    COUNT(t.ticket_id)::int AS total_tickets,
    COUNT(CASE WHEN t.tipo_registro = 'Incidente' THEN 1 END)::int AS incidentes,
    COUNT(CASE WHEN t.tipo_registro = 'Requerimiento' THEN 1 END)::int AS requerimientos,
    ROUND((COUNT(t.ticket_id)::numeric / (SELECT COUNT(*) FROM ticket) * 100), 2) AS porcentaje_total
FROM ticket t
LEFT JOIN causa_raiz cr ON t.causa_raiz_id = cr.causa_raiz_id
LEFT JOIN sistema s ON cr.sistema_id = s.sistema_id
GROUP BY s.codigo, s.nombre
ORDER BY total_tickets DESC;

-- KPI-04: Pareto de causas raíz
CREATE OR REPLACE VIEW vw_kpi04_pareto_causa_raiz AS
WITH resumen_causas AS (
    SELECT 
        cr.categoria AS causa_raiz,
        COALESCE(s.codigo, 'DAT') AS sistema,
        COUNT(t.ticket_id)::int AS cantidad
    FROM ticket t
    LEFT JOIN causa_raiz cr ON t.causa_raiz_id = cr.causa_raiz_id
    LEFT JOIN sistema s ON cr.sistema_id = s.sistema_id
    GROUP BY cr.categoria, s.codigo
)
SELECT 
    causa_raiz,
    sistema,
    cantidad,
    ROUND((cantidad::numeric / (SELECT COUNT(*) FROM ticket) * 100), 2) AS pct_individual,
    ROUND(SUM(cantidad::numeric) OVER (ORDER BY cantidad DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / (SELECT COUNT(*) FROM ticket) * 100, 2) AS pct_acumulado
FROM resumen_causas
ORDER BY cantidad DESC;

-- KPI-05: % de incidentes por daño de terceros (Cable Roto por Trabajos)
CREATE OR REPLACE VIEW vw_kpi05_danio_terceros AS
SELECT 
    to_char(t.fecha, 'YYYY-MM') AS mes,
    COUNT(t.ticket_id)::int AS total_tickets,
    COUNT(CASE WHEN cr.categoria = 'Cable Roto por Trabajos' THEN 1 END)::int AS tickets_danio_terceros,
    ROUND((COUNT(CASE WHEN cr.categoria = 'Cable Roto por Trabajos' THEN 1 END)::numeric / NULLIF(COUNT(t.ticket_id), 0) * 100), 2) AS pct_danio_terceros
FROM ticket t
LEFT JOIN causa_raiz cr ON t.causa_raiz_id = cr.causa_raiz_id
GROUP BY to_char(t.fecha, 'YYYY-MM')
ORDER BY mes ASC;

-- KPI-06: Tiempo promedio de atención por sistema y tipo
CREATE OR REPLACE VIEW vw_kpi06_tiempo_atencion AS
SELECT 
    COALESCE(s.codigo, 'SIN_SISTEMA') AS codigo_sistema,
    COALESCE(s.nombre, 'Sin Sistema') AS nombre_sistema,
    t.tipo_registro,
    ROUND(AVG(t.duracion_horas), 2) AS duracion_promedio_horas,
    COUNT(t.ticket_id)::int AS total_tickets
FROM ticket t
LEFT JOIN causa_raiz cr ON t.causa_raiz_id = cr.causa_raiz_id
LEFT JOIN sistema s ON cr.sistema_id = s.sistema_id
GROUP BY s.codigo, s.nombre, t.tipo_registro
ORDER BY codigo_sistema, t.tipo_registro;

-- KPI-07: Personas-hora totales por mes
CREATE OR REPLACE VIEW vw_kpi07_personas_hora AS
SELECT 
    to_char(fecha, 'YYYY-MM') AS mes,
    SUM(cantidad_personal * duracion_horas)::numeric(10,2) AS personas_hora_totales,
    COUNT(ticket_id)::int AS total_tickets,
    ROUND(AVG(cantidad_personal * duracion_horas), 2) AS personas_hora_promedio_ticket
FROM ticket
GROUP BY to_char(fecha, 'YYYY-MM')
ORDER BY mes ASC;

-- KPI-08: Top ubicaciones con mayor frecuencia
CREATE OR REPLACE VIEW vw_kpi08_top_ubicaciones AS
SELECT 
    u.nombre_normalizado AS ubicacion,
    u.nivel,
    u.piso,
    u.zona,
    COUNT(t.ticket_id)::int AS total_tickets,
    ROUND((COUNT(t.ticket_id)::numeric / (SELECT COUNT(*) FROM ticket) * 100), 2) AS porcentaje_total
FROM ticket t
JOIN ubicacion u ON t.ubicacion_id = u.ubicacion_id
GROUP BY u.nombre_normalizado, u.nivel, u.piso, u.zona
ORDER BY total_tickets DESC;

-- KPI-09: Consumo de materiales por insumo y unidad de medida
CREATE OR REPLACE VIEW vw_kpi09_consumo_materiales AS
SELECT 
    ic.nombre AS insumo,
    ic.codigo_sku,
    ic.unidad_medida,
    ic.categoria,
    SUM(ti.cantidad)::numeric(10,2) AS cantidad_total,
    COUNT(DISTINCT ti.ticket_id)::int AS tickets_consumidores
FROM ticket_insumo ti
JOIN insumo_catalogo ic ON ti.insumo_id = ic.insumo_id
GROUP BY ic.nombre, ic.codigo_sku, ic.unidad_medida, ic.categoria
ORDER BY cantidad_total DESC;

-- KPI-10: Costo de materiales por sistema y mes
CREATE OR REPLACE VIEW vw_kpi10_costo_materiales AS
SELECT 
    to_char(t.fecha, 'YYYY-MM') AS mes,
    COALESCE(s.codigo, 'DAT') AS sistema,
    SUM(ti.cantidad * ic.precio_unitario)::numeric(12,2) AS costo_total_materiales,
    COUNT(DISTINCT t.ticket_id)::int AS total_tickets
FROM ticket t
JOIN ticket_insumo ti ON t.ticket_id = ti.ticket_id
JOIN insumo_catalogo ic ON ti.insumo_id = ic.insumo_id
LEFT JOIN causa_raiz cr ON t.causa_raiz_id = cr.causa_raiz_id
LEFT JOIN sistema s ON cr.sistema_id = s.sistema_id
GROUP BY to_char(t.fecha, 'YYYY-MM'), s.codigo
ORDER BY mes ASC, sistema ASC;
