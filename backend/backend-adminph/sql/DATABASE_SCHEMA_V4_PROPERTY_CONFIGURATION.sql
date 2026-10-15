-- ============================================================
-- AdminPH - MIGRACIÓN V4
-- Configuración de Fase 1 persistida en PostgreSQL por conjunto.
-- No reemplaza ni altera la tabla properties existente.
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS property_configurations (
  property_id UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_property_configurations_updated_at
  ON property_configurations(updated_at DESC);

COMMIT;
