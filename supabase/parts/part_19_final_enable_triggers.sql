-- ==========================================
-- FINAL: Rehabilitar triggers y COMMIT
-- Archivo 19: part_19_final_enable_triggers.sql
-- ==========================================

ALTER TABLE ubicacion ENABLE TRIGGER ALL;
ALTER TABLE insumo ENABLE TRIGGER ALL;
ALTER TABLE cat_causa_raiz ENABLE TRIGGER ALL;
ALTER TABLE tarea ENABLE TRIGGER ALL;
ALTER TABLE tarea_insumo ENABLE TRIGGER ALL;
COMMIT;

