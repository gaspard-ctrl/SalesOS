-- Recordings Claap "découverts" pour un client : trouvés par la discovery
-- directe sur l'API Claap (lib/clients/claap-discovery.ts) au moment de
-- l'enrichissement, mais PAS encore présents dans sales_coach_analyses.
--
-- On les persiste ici pour que le TimelinePanel les affiche immédiatement
-- (sinon ils ne sont visibles que dans le recap deal — la discovery les
-- injecte dans le prompt mais ne laisse aucune trace côté DB).
--
-- Format de chaque item :
--   {
--     "recording_id": "QniZWtSzKNlB",
--     "meeting_title": "Plusgrade Coachello Launch Webinar",
--     "meeting_started_at": "2026-04-29T15:00:00Z",
--     "claap_url": "https://app.claap.io/.../QniZWtSzKNlB",
--     "discovered_at": "2026-05-27T08:42:11Z"
--   }

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS discovered_claap_recordings JSONB NOT NULL DEFAULT '[]'::jsonb;
