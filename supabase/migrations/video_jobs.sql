-- Vidéos avatar HeyGen (Video Studio). Table autonome : une vidéo n'est PAS
-- forcément liée à un client. Quand l'utilisateur parle d'un client, Claude va
-- chercher son contexte dans `clients` (tool get_client_context) et on garde le
-- lien dans client_id (nullable) + client_name dénormalisé pour l'historique.

CREATE TABLE IF NOT EXISTS video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT,
  prompt TEXT NOT NULL DEFAULT '',
  script TEXT NOT NULL,
  heygen_video_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  video_url TEXT,
  error TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS video_jobs_created_at_idx ON video_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS video_jobs_client_id_idx ON video_jobs (client_id);

-- Nettoyage de l'approche précédente (colonne array sur clients) si elle a été
-- appliquée avant ce changement.
ALTER TABLE clients DROP COLUMN IF EXISTS video_jobs;
