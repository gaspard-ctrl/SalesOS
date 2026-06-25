-- Autorise le status 'deleted' (masquage définitif d'un signal depuis la fiche compte).
-- Idempotent : à appliquer sur les bases où prospect_signals existe déjà
-- (le CREATE TABLE IF NOT EXISTS de prospect_signals.sql ne met pas à jour
--  une contrainte CHECK existante). Sur une base neuve, prospect_signals.sql
-- crée déjà la contrainte avec 'deleted' inclus, et ce ALTER est un no-op sûr.

ALTER TABLE IF EXISTS prospect_signals
  DROP CONSTRAINT IF EXISTS prospect_signals_status_check;

ALTER TABLE IF EXISTS prospect_signals
  ADD CONSTRAINT prospect_signals_status_check
  CHECK (status IN ('new', 'actioned', 'dismissed', 'snoozed', 'expired', 'deleted'));
