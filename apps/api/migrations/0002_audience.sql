-- Transitional contract 2026-11-10.1. Non-destructive addition.
-- Existing rank videos retain the old hglobal_verified behaviour.
ALTER TABLE videos ADD COLUMN audience TEXT NOT NULL DEFAULT 'hglobal_verified'
 CHECK(audience IN ('everyone','hglobal_verified'));
