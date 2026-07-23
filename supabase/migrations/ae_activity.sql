-- ────────────────────────────────────────────────────────────────────────
-- AE Sales Activity dashboard (admin) — cached per-rep snapshots.
--
-- Vue manager comparant l'activité commerciale des AE : prospection (appels,
-- emails), meetings, pipeline, deals, et revenu facturé vs objectifs.
--
-- 1 row par sales rep (clé = hubspot_owner_id). `payload` contient toutes les
-- métriques pré-calculées (buckets par granularité, funnel, raisons closed-lost,
-- revenu vs targets tirés du Sheet Drive, coaching auto). Recalculé 1x/semaine
-- par une Netlify scheduled function + à la demande via le bouton "Refresh".
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ae_activity_snapshots (
  rep_owner_id  TEXT PRIMARY KEY,          -- HubSpot hubspot_owner_id
  rep_name      TEXT,
  rep_email     TEXT,
  payload       JSONB NOT NULL,            -- RepSnapshot (voir lib/ae-activity/types.ts)
  refreshed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meta singleton : état du dernier refresh global. Permet à l'UI d'afficher
-- "refresh en cours…", la date du dernier passage et une éventuelle erreur,
-- même avant qu'aucune row rep n'existe.
CREATE TABLE IF NOT EXISTS ae_activity_meta (
  id            INT PRIMARY KEY DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'idle',   -- idle | running | done | error
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  error_message TEXT,
  rep_count     INT,
  CONSTRAINT ae_activity_meta_singleton CHECK (id = 1)
);

INSERT INTO ae_activity_meta (id, status) VALUES (1, 'idle')
  ON CONFLICT (id) DO NOTHING;
