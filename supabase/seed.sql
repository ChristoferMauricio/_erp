-- 1. Insertar Empresa Principal
INSERT INTO empresa (id, nombre, ruc)
VALUES ('99f4852c-c516-43c3-9b88-1d2a450550c6', 'Comunicaciones y Monitoreo Minero S.A.C.', '20123456789')
ON CONFLICT (ruc) DO UPDATE SET nombre = EXCLUDED.nombre;

-- 2. Insertar Unidad Minera Yauricocha (UM Corona)
INSERT INTO unidad_minera (id, empresa_id, nombre, codigo)
VALUES ('d3f1d530-671e-450f-a42e-13ccb9554fe1', '99f4852c-c516-43c3-9b88-1d2a450550c6', 'UM Corona', 'Yauricocha')
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre;

-- 3. Insertar Catálogo de Tipos
INSERT INTO cat_tipo (id, nombre) VALUES
('76288647-79b8-4c6e-a34f-83602d3345d2', 'Incidente'),
('c6a9b40b-77f6-4995-b9f1-d007c08a9844', 'Requerimiento')
ON CONFLICT (nombre) DO NOTHING;

-- 4. Insertar Catálogo de Áreas
INSERT INTO cat_area (id, nombre) VALUES
('c525f0e1-7e8c-4a30-80a5-b1a8d052a5ab', 'Infraestructura')
ON CONFLICT (nombre) DO NOTHING;

-- 5. Insertar Catálogo de Orígenes
INSERT INTO cat_origen (id, nombre) VALUES
('64816fa8-48be-4d9f-9556-32d84c6c06bc', 'IM'),
('8a972c21-f09c-4f7f-acdf-4db2cbf866ef', 'SUP')
ON CONFLICT (nombre) DO NOTHING;

-- 6. Insertar Catálogo de Subsistemas
INSERT INTO cat_subsistema (id, codigo, nombre) VALUES
('c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'DAT', 'Datos / Red'),
('f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c', 'CCTV', 'CCTV / Video'),
('a0c325c4-722a-4db3-90d5-1fa8d3c7c4e5', 'RAD', 'Radial / Leaky Feeder'),
('b4b6d080-60b6-4074-be46-34d602db0786', 'TEL', 'Telefonía'),
('e5f5c04b-cb2b-42fa-b715-db14e2c88fc7', 'GEO', 'Geófonos'),
('da4d4a8e-a4b5-4b35-862d-9442a8b9e6c2', 'FO', 'Fibra Óptica'),
('df3a0c50-b0d4-42b7-a3a4-1234a8b9e6c2', 'WIFI', 'Red Wi-Fi')
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre;

-- 7. Insertar Catálogo de Unidades de Medida
INSERT INTO cat_unidad_medida (id, simbolo, nombre) VALUES
('e9f96b26-a05e-4c8d-9b55-d14bb22e3745', 'UN', 'Unidad'),
('cf5b6c20-7f22-482a-aef2-f5bb64c7847c', 'M', 'Metro'),
('bf2c8230-8a2b-4a50-b98a-2bb64d88fc44', 'LT', 'Litro')
ON CONFLICT (simbolo) DO UPDATE SET nombre = EXCLUDED.nombre;

-- 8. Insertar Catálogo de Causas Raíz Semilla (por Subsistema)
-- Telefonía (TEL)
INSERT INTO cat_causa_raiz (subsistema_id, nombre) VALUES
('b4b6d080-60b6-4074-be46-34d602db0786', 'Instalación Nueva (TEL)'),
('b4b6d080-60b6-4074-be46-34d602db0786', 'Cable Roto por Trabajos (TEL)'),
('b4b6d080-60b6-4074-be46-34d602db0786', 'Teléfono Averiado'),
('b4b6d080-60b6-4074-be46-34d602db0786', 'Mantenimiento Programado (TEL)');

-- CCTV (CCTV)
INSERT INTO cat_causa_raiz (subsistema_id, nombre) VALUES
('f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c', 'Instalación Nueva (CCTV)'),
('f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c', 'Cable Roto por Trabajos (CCTV)'),
('f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c', 'Cámara Averiada'),
('f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c', 'Balun Averiado'),
('f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c', 'Mantenimiento Programado (CCTV)');

-- Datos (DAT)
INSERT INTO cat_causa_raiz (subsistema_id, nombre) VALUES
('c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Instalación Nueva (DAT)'),
('c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Cable Roto por Trabajos (DAT)'),
('c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Equipo Averiado'),
('c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Mantenimiento Correctivo Switch'),
('c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Switch apagado por monóxido'),
('c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Mantenimiento Programado (DAT)');

-- Radial / Leaky Feeder (RAD)
INSERT INTO cat_causa_raiz (subsistema_id, nombre) VALUES
('a0c325c4-722a-4db3-90d5-1fa8d3c7c4e5', 'Instalación Nueva (RAD)'),
('a0c325c4-722a-4db3-90d5-1fa8d3c7c4e5', 'Cable Roto por Trabajos (RAD)'),
('a0c325c4-722a-4db3-90d5-1fa8d3c7c4e5', 'Mantenimiento Programado (RAD)');

-- Geófonos (GEO)
INSERT INTO cat_causa_raiz (subsistema_id, nombre) VALUES
('e5f5c04b-cb2b-42fa-b715-db14e2c88fc7', 'Instalación Nueva (GEO)'),
('e5f5c04b-cb2b-42fa-b715-db14e2c88fc7', 'Cable Roto por Trabajos (GEO)'),
('e5f5c04b-cb2b-42fa-b715-db14e2c88fc7', 'Mantenimiento Programado (GEO)');

-- Fibra Óptica (FO)
INSERT INTO cat_causa_raiz (subsistema_id, nombre) VALUES
('da4d4a8e-a4b5-4b35-862d-9442a8b9e6c2', 'Instalación Nueva (FO)'),
('da4d4a8e-a4b5-4b35-862d-9442a8b9e6c2', 'Cable Roto por Trabajos (FO)'),
('da4d4a8e-a4b5-4b35-862d-9442a8b9e6c2', 'Mantenimiento Programado (FO)');

-- Wi-Fi (WIFI)
INSERT INTO cat_causa_raiz (subsistema_id, nombre) VALUES
('df3a0c50-b0d4-42b7-a3a4-1234a8b9e6c2', 'Instalación Nueva (Wi-Fi)'),
('df3a0c50-b0d4-42b7-a3a4-1234a8b9e6c2', 'Mantenimiento Programado (Wi-Fi)');
