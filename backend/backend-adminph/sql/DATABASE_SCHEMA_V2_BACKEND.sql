-- ============================================================
-- AdminPH - MIGRACIÓN V2 PARA BACKEND REAL (CORREGIDA)
-- Ejecutar UNA VEZ después de DATABASE_SCHEMA_V1.sql
-- Regla central: UNA unidad = UNA papeleta por actividad de votación.
-- Una actividad puede declarar varios ganadores, pero el votante
-- no selecciona varios candidatos en la misma actividad.
-- ============================================================
BEGIN;

-- 1) Asistencia: conservar identidad real/snapshot del asistente.
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS attendance_role VARCHAR(20) NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS attendee_name_snapshot VARCHAR(200),
  ADD COLUMN IF NOT EXISTS attendee_document_snapshot VARCHAR(80);

DO $$ BEGIN
  ALTER TABLE attendance ADD CONSTRAINT chk_attendance_role CHECK (attendance_role IN ('owner','proxy'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Configuración de votación y publicación en acta.
ALTER TABLE voting_sessions
  ADD COLUMN IF NOT EXISTS include_voter_details_in_minutes BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS multiple_winners BOOLEAN NOT NULL DEFAULT FALSE;

-- Compatibilidad con V1: selection_multiple deja de significar que un votante
-- pueda elegir varias opciones. El backend la mantiene siempre en FALSE.
UPDATE voting_sessions SET selection_multiple = FALSE WHERE selection_multiple IS TRUE;

-- 3) Checklist de ganadores. Se usa después del cierre para visar los elegidos.
ALTER TABLE voting_options
  ADD COLUMN IF NOT EXISTS is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS winner_marked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS winner_marked_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_voting_options_winner
  ON voting_options(voting_session_id, is_winner);

-- 4) Trazabilidad histórica exacta del voto.
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS attendance_id UUID REFERENCES attendance(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voter_name_snapshot VARCHAR(200),
  ADD COLUMN IF NOT EXISTS voter_document_snapshot VARCHAR(80),
  ADD COLUMN IF NOT EXISTS unit_number_snapshot VARCHAR(100);

-- Regla inviolable: una sola fila de voto por unidad y por sesión/actividad.
DROP INDEX IF EXISTS ux_votes_session_unit_option;
CREATE UNIQUE INDEX IF NOT EXISTS ux_votes_session_unit
  ON votes(voting_session_id, unit_id);

CREATE INDEX IF NOT EXISTS idx_votes_session_option
  ON votes(voting_session_id, voting_option_id);
CREATE INDEX IF NOT EXISTS idx_votes_attendance
  ON votes(attendance_id);

-- 5) QR multipropósito: un QR activo por unidad/asamblea, reutilizable en todas
-- las votaciones de esa asamblea, con posibilidad de reemisión/revocación.
ALTER TABLE qr_tokens
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE qr_tokens DROP CONSTRAINT IF EXISTS qr_tokens_assembly_id_unit_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_qr_tokens_one_active_per_unit
  ON qr_tokens(assembly_id, unit_id)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_qr_tokens_active
  ON qr_tokens(assembly_id, active);

COMMIT;
