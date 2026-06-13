-- =====================================================================
-- Migración 0003: deduplicación de la ingesta mensual
-- ---------------------------------------------------------------------
-- import_hash = huella de contenido de la actividad (md5 de su clave
-- natural + insumos). Permite que re-subir el mismo Excel NO duplique
-- (INSERT ... ON CONFLICT (import_hash) DO NOTHING).
-- Índice parcial: solo aplica a filas insertadas por el módulo de ingesta
-- (las históricas quedan con import_hash NULL y no chocan entre sí).
-- =====================================================================

ALTER TABLE tarea ADD COLUMN IF NOT EXISTS import_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tarea_import_hash
    ON tarea (import_hash)
    WHERE import_hash IS NOT NULL;
