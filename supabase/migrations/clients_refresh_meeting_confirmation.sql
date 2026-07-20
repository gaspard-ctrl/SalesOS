-- Confirmation des NOUVEAUX meetings Claap détectés lors d'un refresh (bouton
-- "Actualiser" ou cron mensuel), par opposition à clients_meeting_confirmation.sql
-- qui gère la confirmation initiale à l'import.
-- ────────────────────────────────────────────────────────────────────────
-- Le refresh incrémental (lib/clients/run-refresh.ts) détecte les meetings
-- Claap "nouveaux" pour ce client (ni indexés sous son hubspot_deal_id, ni
-- déjà dans confirmed_claap_recordings / discovered_claap_recordings, ni
-- déclinés). Si le trigger est manuel (bouton), le refresh s'arrête et
-- propose ces candidats dans un popup. Si le trigger est le cron mensuel,
-- ils sont inclus automatiquement (pas d'humain disponible).
--
-- pending_refresh_meeting_candidates : candidats détectés lors d'un refresh
--   manuel, en attente de décision humaine. Même format que
--   pending_meeting_candidates (cf. clients_meeting_confirmation.sql).
--
-- declined_claap_recording_ids : recording_id explicitement déclinés par un
--   humain lors d'un popup de refresh. Exclus définitivement de la discovery
--   pour ce client (jamais reproposés, jamais utilisés dans les données).

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS pending_refresh_meeting_candidates JSONB,
  ADD COLUMN IF NOT EXISTS declined_claap_recording_ids       TEXT[];
