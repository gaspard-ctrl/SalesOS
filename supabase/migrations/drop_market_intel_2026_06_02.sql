-- Retrait de la feature "Market Intel" (signaux marché) qui n'existe plus.
-- On garde la Watch List (comptes cibles + listes HubSpot) ; seule la couche
-- signaux est supprimée. À exécuter dans Supabase SQL Editor.

-- Table des signaux marché (plus aucun writer côté code).
DROP TABLE IF EXISTS market_signals CASCADE;

-- Config d'alerte Slack du Market Intel (stockée à 2 endroits historiquement).
DELETE FROM guide_defaults WHERE key = 'alert_config';
ALTER TABLE users DROP COLUMN IF EXISTS alert_config;
