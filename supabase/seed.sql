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
INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES
('6095cabd-b71d-598f-b63d-f59dba02c3ff', 'b4b6d080-60b6-4074-be46-34d602db0786', 'Instalación Nueva (TEL)'),
('033f114d-4b0f-5b4a-8a70-2bedf2829eca', 'b4b6d080-60b6-4074-be46-34d602db0786', 'Teléfono averiado'),
('fe74ab96-c3ea-51ac-8cfd-c6b9e7e6500e', 'b4b6d080-60b6-4074-be46-34d602db0786', 'Mantenimiento Programado (TEL)'),
('3cf1f3a6-9fc3-5448-9bba-11fcea5d7919', 'b4b6d080-60b6-4074-be46-34d602db0786', 'Cable Roto por Trabajos (TEL)'),
('880b77e7-1a4a-585c-a3cf-bc20933857dc', 'b4b6d080-60b6-4074-be46-34d602db0786', 'Teléfono Averiado')
ON CONFLICT (subsistema_id, nombre) DO UPDATE SET id = EXCLUDED.id;

-- CCTV (CCTV)
INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES
('a08743b4-0b39-5b5c-930b-f7af1e15e612', 'f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c', 'Instalación Nueva (CCTV)'),
('dbaf5949-d769-54e4-b5ce-3ce41676a6f4', 'f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c', 'Cable Roto por Trabajos (CCTV)'),
('667c4b92-fe84-569f-807e-e94fdc34d0d9', 'f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c', 'Balun Averiado'),
('29662a4e-87cd-51cc-84d4-7d83820bd5eb', 'f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c', 'Cámara Averiado'),
('b982f5ea-77c3-5518-a8d3-4b24fdd46dc9', 'f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c', 'Mantenimiento Programado (CCTV)')
ON CONFLICT (subsistema_id, nombre) DO UPDATE SET id = EXCLUDED.id;

-- Datos (DAT)
INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES
('4b2bf25f-4637-547d-9c31-372dc4957ea0', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Equipo Averiado'),
('5cc85a79-df61-52ca-ab9e-b46937593872', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Mantenimiento Programado (DAT)'),
('5b8d6ced-a67c-5849-88d8-94ed0cd1c22c', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Instalación Nueva (DAT)'),
('0289e56b-5e23-505e-bf93-e81a4c1dcd76', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Mantenimiento  Correctivo Switch.'),
('0e615f7b-4d1e-5a3d-902e-eb35ac70cf5f', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Falla General del Sistemas Eléctrico'),
('54436359-ced8-5141-8c81-88b600546714', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Cable Roto por Trabajos (DAT)'),
('9f283e28-35a4-5877-b355-11221360e9b1', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Acumulación Monóxido'),
('e255d3db-d296-589a-b01c-9445f002b891', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Fuente averiada'),
('a5144614-1937-54e2-9cfd-52aeb17c03bf', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Switch apagado por mónoxido'),
('68c05cc0-4d02-55b0-b533-4eaeaeade6d0', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Mantenimiento Programado'),
('aa04fcff-a09a-5a32-87bc-f985a873b96d', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'REQUERIMIENTO'),
('49047ae1-b36e-5d95-b764-22af17dd1a2d', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Termino de explotación')
ON CONFLICT (subsistema_id, nombre) DO UPDATE SET id = EXCLUDED.id;

-- Radial / Leaky Feeder (RAD)
INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES
('95de76e5-3681-5b65-9aa2-7070c2db9c8f', 'a0c325c4-722a-4db3-90d5-1fa8d3c7c4e5', 'Cable Roto por Trabajos (RAD)'),
('0a1ccd8a-d649-5c76-8bea-a31be90ae08d', 'a0c325c4-722a-4db3-90d5-1fa8d3c7c4e5', 'Mantenimiento Programado (RAD)'),
('41b9bce2-779f-5f62-bd61-e60568d484f7', 'a0c325c4-722a-4db3-90d5-1fa8d3c7c4e5', 'Instalación Nueva (RAD)'),
('ed47e4df-65df-59a9-96cc-03f1669dea57', 'a0c325c4-722a-4db3-90d5-1fa8d3c7c4e5', 'Poste roto por colición de volquete')
ON CONFLICT (subsistema_id, nombre) DO UPDATE SET id = EXCLUDED.id;

-- Geófonos (GEO)
INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES
('01c5024b-cb81-5d32-945c-ec91a74090f7', 'e5f5c04b-cb2b-42fa-b715-db14e2c88fc7', 'Mantenimiento Programado (GEO)'),
('120267ad-7a8b-5b7f-a48a-1c168a62bd0b', 'e5f5c04b-cb2b-42fa-b715-db14e2c88fc7', 'Cable Roto por Trabajos (GEO)'),
('3b1aea92-95b5-51ee-972b-615c0eeea969', 'e5f5c04b-cb2b-42fa-b715-db14e2c88fc7', 'Instalación Nueva (GEO)')
ON CONFLICT (subsistema_id, nombre) DO UPDATE SET id = EXCLUDED.id;

-- Fibra Óptica (FO)
INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES
('766f78c4-6287-5281-a0cb-f3d8e5d132a1', 'da4d4a8e-a4b5-4b35-862d-9442a8b9e6c2', 'Instalación Nueva (FO)'),
('4fb2d002-810f-5bc7-b1a8-a31b63c2c1b5', 'da4d4a8e-a4b5-4b35-862d-9442a8b9e6c2', 'Cable Roto por Trabajos (FO)'),
('58d571d1-3611-5f89-a2a7-acac2abbfc0c', 'da4d4a8e-a4b5-4b35-862d-9442a8b9e6c2', 'Mantenimiento Programado (FO)')
ON CONFLICT (subsistema_id, nombre) DO UPDATE SET id = EXCLUDED.id;

-- Wi-Fi (WIFI)
INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES
('40368372-f145-5025-8d94-b1ce378d7cca', 'df3a0c50-b0d4-42b7-a3a4-1234a8b9e6c2', 'AP inoperativo'),
('f9cfd3f8-9d41-5247-81d3-f85578969761', 'df3a0c50-b0d4-42b7-a3a4-1234a8b9e6c2', 'Instalación Nueva (Wi-Fi)'),
('4486418a-dfcc-5cbd-9f3f-281b00ef543a', 'df3a0c50-b0d4-42b7-a3a4-1234a8b9e6c2', 'Instalación Nueva (WIFI)')
ON CONFLICT (subsistema_id, nombre) DO UPDATE SET id = EXCLUDED.id;
