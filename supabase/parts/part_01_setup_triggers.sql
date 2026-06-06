-- ==========================================
-- SETUP: Deshabilitar triggers para carga masiva
-- Archivo 1: part_01_setup_triggers.sql
-- ==========================================

-- ==========================================================
-- MIGRACIÓN DE DATOS HISTÓRICOS (YAURICOCHA - CORONA)
-- ==========================================================
BEGIN;
ALTER TABLE ubicacion DISABLE TRIGGER ALL;
ALTER TABLE insumo DISABLE TRIGGER ALL;
ALTER TABLE cat_causa_raiz DISABLE TRIGGER ALL;
ALTER TABLE tarea DISABLE TRIGGER ALL;
ALTER TABLE tarea_insumo DISABLE TRIGGER ALL;

