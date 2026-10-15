-- ============================================================
-- AdminPH - MIGRACIÓN V5
-- Unidades y coeficientes de Fase 1 persistidos en PostgreSQL.
-- Extiende la tabla units existente sin borrar información histórica.
-- ============================================================
BEGIN;

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS unit_type VARCHAR(30) NOT NULL DEFAULT 'residencial',
  ADD COLUMN IF NOT EXISTS hierarchy JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS base_coefficient NUMERIC(18,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parking_coefficient NUMERIC(18,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS owner_document VARCHAR(80),
  ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(80),
  ADD COLUMN IF NOT EXISTS frontend_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Compatibilidad con unidades creadas por las migraciones/seed anteriores.
UPDATE units
SET display_name = COALESCE(NULLIF(display_name, ''), unit_number),
    base_coefficient = CASE
      WHEN COALESCE(base_coefficient, 0) = 0 THEN COALESCE(total_coefficient, 0)
      ELSE base_coefficient
    END,
    parking_coefficient = COALESCE(parking_coefficient, 0),
    hierarchy = COALESCE(hierarchy, '{}'::jsonb),
    frontend_meta = COALESCE(frontend_meta, '{}'::jsonb),
    active = COALESCE(active, TRUE),
    updated_at = COALESCE(updated_at, NOW());

CREATE INDEX IF NOT EXISTS idx_units_property_active_row
  ON units(property_id, active, row_number);

CREATE INDEX IF NOT EXISTS idx_units_property_display_name
  ON units(property_id, display_name);

COMMIT;
