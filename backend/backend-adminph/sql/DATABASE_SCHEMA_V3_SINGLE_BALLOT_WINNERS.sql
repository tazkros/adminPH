-- ============================================================
-- AdminPH - MIGRACIÓN V3 CORRECTIVA
-- SOLO usar si ya ejecutaste la V2 anterior que permitía varias
-- opciones por unidad en una misma votación.
-- Restablece: UNA unidad = UNA papeleta por actividad.
-- Añade checklist auditable de ganadores.
-- ============================================================
BEGIN;

ALTER TABLE voting_sessions
  ADD COLUMN IF NOT EXISTS multiple_winners BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE voting_sessions
SET multiple_winners = (COALESCE(winners_required, 0) > 1),
    selection_multiple = FALSE;

ALTER TABLE voting_options
  ADD COLUMN IF NOT EXISTS is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS winner_marked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS winner_marked_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_voting_options_winner
  ON voting_options(voting_session_id, is_winner);

-- Evitar crear el índice único si ya existen duplicados históricos.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM votes
    GROUP BY voting_session_id, unit_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existen unidades con más de un voto en la misma actividad. Revise esos registros antes de aplicar V3.';
  END IF;
END $$;

DROP INDEX IF EXISTS ux_votes_session_unit_option;
CREATE UNIQUE INDEX IF NOT EXISTS ux_votes_session_unit
  ON votes(voting_session_id, unit_id);

COMMIT;
