-- Historique des emails : on enrichit outreach_log pour stocker le corps du mail,
-- le type de destinataire (to/cc/bcc) et le lien vers la company watchlist, afin
-- d'afficher l'historique complet (fiche company + modale par contact) et de
-- compter les emails par company sur le board.
--
-- Regroupement d'un envoi : tous les destinataires d'un même email partagent le
-- même `source_id` (genere cote route /api/gmail/send). "1 email" = 1 source_id.

ALTER TABLE outreach_log
  ADD COLUMN IF NOT EXISTS body              TEXT,
  ADD COLUMN IF NOT EXISTS scope_company_id  UUID,
  ADD COLUMN IF NOT EXISTS recipient_kind    TEXT,
  ADD COLUMN IF NOT EXISTS sender_email      TEXT;

-- Comptage rapide des emails par company (board + fiche).
CREATE INDEX IF NOT EXISTS idx_outreach_log_user_company
  ON outreach_log (user_id, scope_company_id)
  WHERE scope_company_id IS NOT NULL;

-- Statut manuel optionnel par company (override de la valeur auto-derivee des envois).
-- NULL = auto (To enrich si 0 email, Contacted si >= 1).
ALTER TABLE scope_companies
  ADD COLUMN IF NOT EXISTS status TEXT;
