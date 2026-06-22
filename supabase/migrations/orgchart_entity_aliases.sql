-- Fusion permanente de "companies" (entités) dans l'organigramme.
-- Sur le whiteboard, les cartes sont regroupées par `entity`. Deux entités
-- HubSpot distinctes mais identiques en pratique (Allianz / Allianz Trade) sont
-- fusionnées en mémorisant un alias { source (lowercased) -> entité canonique }.
-- Appliqué automatiquement à l'import et au Refresh pour que la fusion ne casse
-- jamais.
ALTER TABLE orgchart_accounts
  ADD COLUMN IF NOT EXISTS entity_aliases JSONB NOT NULL DEFAULT '{}'::jsonb;
