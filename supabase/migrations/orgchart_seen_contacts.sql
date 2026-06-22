-- "Refresh" doit AJOUTER les nouveaux contacts HubSpot d'un compte, mais jamais
-- réinjecter ceux exclus à l'onboarding (ou supprimés ensuite). On mémorise donc
-- l'ensemble des contacts HubSpot déjà "vus"/décidés pour le compte : tous ceux
-- offerts à l'import (sélectionnés OU décochés) + tous ceux passés par le chart.
-- Le Refresh n'auto-ajoute QUE les contacts ABSENTS de cet ensemble (donc
-- réellement nouveaux dans HubSpot) ; les exclus/supprimés y restent et ne
-- reviennent jamais.
ALTER TABLE orgchart_accounts
  ADD COLUMN IF NOT EXISTS seen_contact_ids TEXT[] NOT NULL DEFAULT '{}'::text[];
