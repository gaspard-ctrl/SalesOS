-- 1) Pièces jointes du chat (cahiers des charges, RFP, briefs...). Uploadées via
-- POST /api/chat/attachments, puis référencées par leurs IDs dans POST /api/chat
-- qui les expand en blocs de contenu Anthropic (document PDF natif, image, ou
-- texte extrait pour xlsx/csv/docx/txt/md). Le contenu vit ici, pas dans le
-- message : les messages ne portent que la version expandée dans api_history.
CREATE TABLE IF NOT EXISTS chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  -- kind: pdf | image | text (comment le fichier est servi au modèle)
  kind TEXT NOT NULL,
  -- Texte extrait (xlsx/csv/docx/txt/md), NULL pour pdf/image
  text_content TEXT,
  -- Base64 du fichier original (pdf/image, envoyés en blocs natifs Anthropic)
  base64 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_attachments_user_idx ON chat_attachments (user_id, created_at DESC);

-- 2) Sources citées pendant une réponse (pages Notion lues, meetings Claap,
-- fichiers Drive...), émises par les outils via l'event "source" et accumulées
-- par lib/chat/run-job.ts. Le front les affiche en indicateurs pendant et après
-- la réponse (panneau "ce que je consulte").
ALTER TABLE chat_jobs ADD COLUMN IF NOT EXISTS sources JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE users
SET user_prompt = NULL
WHERE user_prompt LIKE 'Tu es CoachelloGPT, l''assistant IA de l''équipe commerciale de Coachello.%';

CREATE TABLE IF NOT EXISTS rag_guide_snapshot (
  path TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
