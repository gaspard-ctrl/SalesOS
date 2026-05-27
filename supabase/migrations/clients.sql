-- Clients : vie du compte après signature (closed-won)
-- ────────────────────────────────────────────────────────────────────────
-- Une row = un deal HubSpot passé à closed-won. Idempotent sur le deal_id
-- (HubSpot peut rejouer le webhook, et l'utilisateur peut "Re-enrichir"
-- manuellement depuis l'UI).
--
-- fields_json regroupe les 6 sections du brief client (voir lib/clients/types.ts).
-- On garde value+confidence+source+updated_at par field pour pouvoir
-- surligner les champs incertains et tracer la provenance.

CREATE TABLE IF NOT EXISTS clients (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_deal_id       TEXT UNIQUE NOT NULL,
  hubspot_company_id    TEXT,
  company_name          TEXT NOT NULL,
  owner_email           TEXT,
  owner_name            TEXT,
  closedwon_at          TIMESTAMPTZ NOT NULL,
  deal_amount           NUMERIC,
  fields_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
  deal_recap            JSONB,
  health                JSONB,
  health_history        JSONB NOT NULL DEFAULT '[]'::jsonb,
  insights              JSONB,
  news                  JSONB,
  enrichment_status     TEXT NOT NULL DEFAULT 'pending',
  enrichment_error      TEXT,
  last_enriched_at      TIMESTAMPTZ,
  last_health_run_at    TIMESTAMPTZ,
  last_news_run_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_company ON clients (hubspot_company_id);
CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients (owner_email);
CREATE INDEX IF NOT EXISTS idx_clients_closedwon ON clients (closedwon_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients (enrichment_status);
