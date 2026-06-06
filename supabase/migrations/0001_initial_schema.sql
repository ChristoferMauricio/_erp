-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Estructura Multi-tenant
CREATE TABLE empresa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    ruc VARCHAR(20) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE unidad_minera (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Catálogos Maestros (Normalizados)
CREATE TABLE cat_tipo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE cat_area (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE cat_origen (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL UNIQUE -- IM (Interior Mina) | SUP (Superficie)
);

CREATE TABLE cat_subsistema (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(20) NOT NULL UNIQUE, -- DAT, CCTV, RAD, TEL, GEO, FO, WIFI
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE cat_causa_raiz (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subsistema_id UUID REFERENCES cat_subsistema(id) ON DELETE SET NULL,
    nombre VARCHAR(255) NOT NULL,
    UNIQUE(subsistema_id, nombre)
);

CREATE TABLE cat_unidad_medida (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simbolo VARCHAR(20) NOT NULL UNIQUE, -- UN, M, LT, etc.
    nombre VARCHAR(100) NOT NULL
);

-- 3. Ubicaciones Jerárquicas (Parseadas de texto libre)
CREATE TABLE ubicacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unidad_minera_id UUID NOT NULL REFERENCES unidad_minera(id) ON DELETE CASCADE,
    nivel VARCHAR(100),         -- P. ej. NV.670
    zona VARCHAR(255),          -- P. ej. Fortuna
    punto VARCHAR(255),         -- P. ej. Camara de refugio
    texto_original TEXT NOT NULL, -- P. ej. NV.670 Fortuna Camara de refugio
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Insumos e Inventario
CREATE TABLE insumo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_normalizado VARCHAR(255) NOT NULL UNIQUE,
    unidad_medida_id UUID NOT NULL REFERENCES cat_unidad_medida(id),
    categoria VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE almacen (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unidad_minera_id UUID NOT NULL REFERENCES unidad_minera(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(unidad_minera_id, nombre)
);

CREATE TABLE stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    almacen_id UUID NOT NULL REFERENCES almacen(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES insumo(id) ON DELETE CASCADE,
    cantidad NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (cantidad >= 0),
    punto_reorden NUMERIC(12, 4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(almacen_id, insumo_id)
);

-- 5. Personal y Cuadrillas
CREATE TABLE personal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unidad_minera_id UUID NOT NULL REFERENCES unidad_minera(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    rol VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cuadrilla (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unidad_minera_id UUID NOT NULL REFERENCES unidad_minera(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(unidad_minera_id, nombre)
);

CREATE TABLE cuadrilla_miembro (
    cuadrilla_id UUID NOT NULL REFERENCES cuadrilla(id) ON DELETE CASCADE,
    personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
    PRIMARY KEY (cuadrilla_id, personal_id)
);

-- 6. Núcleo: Tarea (Cabecera)
CREATE TABLE tarea (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unidad_minera_id UUID NOT NULL REFERENCES unidad_minera(id) ON DELETE CASCADE,
    ticket VARCHAR(100),
    tipo_id UUID NOT NULL REFERENCES cat_tipo(id),
    area_id UUID NOT NULL REFERENCES cat_area(id),
    origen_id UUID NOT NULL REFERENCES cat_origen(id),
    ubicacion_id UUID NOT NULL REFERENCES ubicacion(id),
    causa_raiz_id UUID REFERENCES cat_causa_raiz(id),
    cant_personas INTEGER CHECK (cant_personas >= 0),
    tiempo_horas NUMERIC(6, 2) CHECK (tiempo_horas >= 0),
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    periodo DATE,
    detalle TEXT,
    trabajo_realizado TEXT,
    estado VARCHAR(50) DEFAULT 'Cerrada', -- Registradas en Excel histórico están cerradas
    created_by UUID, -- Relación posterior con supabase auth
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Líneas Hijas de Consumo de Insumo
CREATE TABLE tarea_insumo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tarea_id UUID NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES insumo(id) ON DELETE RESTRICT,
    cantidad NUMERIC(12, 4) NOT NULL CHECK (cantidad > 0),
    unidad_medida_id UUID NOT NULL REFERENCES cat_unidad_medida(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Relación Tarea-Personal
CREATE TABLE tarea_personal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tarea_id UUID NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
    cuadrilla_id UUID REFERENCES cuadrilla(id) ON DELETE SET NULL,
    personal_id UUID REFERENCES personal(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Evidencias
CREATE TABLE evidencia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tarea_id UUID NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    descripcion VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Movimientos de Stock (Kardex)
CREATE TABLE movimiento_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insumo_id UUID NOT NULL REFERENCES insumo(id) ON DELETE RESTRICT,
    almacen_id UUID NOT NULL REFERENCES almacen(id) ON DELETE RESTRICT,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
    cantidad NUMERIC(12, 4) NOT NULL CHECK (cantidad > 0),
    tarea_id UUID REFERENCES tarea(id) ON DELETE SET NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usuario_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. SLA Config
CREATE TABLE sla_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unidad_minera_id UUID NOT NULL REFERENCES unidad_minera(id) ON DELETE CASCADE,
    tipo_id UUID NOT NULL REFERENCES cat_tipo(id) ON DELETE CASCADE,
    horas_objetivo NUMERIC(6, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(unidad_minera_id, tipo_id)
);

-- 12. Auditoría
CREATE TABLE auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidad VARCHAR(100) NOT NULL,
    entidad_id UUID NOT NULL,
    accion VARCHAR(20) NOT NULL CHECK (accion IN ('CREATE', 'UPDATE', 'DELETE')),
    payload JSONB NOT NULL,
    usuario_id UUID,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
