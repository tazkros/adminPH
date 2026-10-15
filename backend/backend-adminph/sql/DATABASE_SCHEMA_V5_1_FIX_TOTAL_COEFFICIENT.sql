-- ============================================================
-- AdminPH - HOTFIX V5.1
-- Corrige units.total_coefficient para trabajar con los campos
-- base_coefficient + parking_coefficient sin intentar escribir
-- directamente sobre una columna GENERATED ALWAYS.
--
-- Ejecutar UNA sola vez después de DATABASE_SCHEMA_V5_UNITS_FRONTEND.sql.
-- ============================================================
BEGIN;

-- Copia de seguridad de los coeficientes antes de redefinir la columna.
CREATE TABLE IF NOT EXISTS units_coefficient_backup_v51 AS
SELECT id,
       property_id,
       total_coefficient AS total_coefficient_before,
       base_coefficient AS base_coefficient_before,
       parking_coefficient AS parking_coefficient_before,
       NOW() AS backed_up_at
FROM units
WITH NO DATA;

INSERT INTO units_coefficient_backup_v51(
  id, property_id, total_coefficient_before,
  base_coefficient_before, parking_coefficient_before, backed_up_at
)
SELECT u.id, u.property_id, u.total_coefficient,
       u.base_coefficient, u.parking_coefficient, NOW()
FROM units u
WHERE NOT EXISTS (
  SELECT 1 FROM units_coefficient_backup_v51 b WHERE b.id = u.id
);

-- Conserva exactamente el total actual antes de cambiar la fórmula.
-- Si total=25 y parqueadero=2, la base queda en 23 y el nuevo total vuelve a ser 25.
UPDATE units
SET parking_coefficient = COALESCE(parking_coefficient, 0),
    base_coefficient = COALESCE(total_coefficient, 0) - COALESCE(parking_coefficient, 0);

-- Estandariza el total como columna calculada por PostgreSQL.
-- No usamos CASCADE: si existiera una dependencia inesperada, la transacción
-- fallará y no se perderá ningún dato.
ALTER TABLE units DROP COLUMN total_coefficient;

ALTER TABLE units
  ADD COLUMN total_coefficient NUMERIC(18,8)
  GENERATED ALWAYS AS (
    COALESCE(base_coefficient, 0) + COALESCE(parking_coefficient, 0)
  ) STORED;

COMMIT;
