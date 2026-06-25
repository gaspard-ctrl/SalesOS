-- One-off : retire du feed les signaux Apollo "nouveaux décideurs ICP" déjà
-- accumulés. Cette source a été retirée du sweep (ce ne sont pas des événements
-- temps-réel mais un annuaire de décideurs pas encore en CRM, qui noyait le feed,
-- ~218 sur 231 'new'). Le code ne les réinsère plus ; on expire ceux en base.
-- On passe en 'expired' (on garde la row + sa dedupe_key) plutôt que DELETE.
-- Idempotent, re-jouable.

UPDATE prospect_signals
SET status = 'expired', updated_at = NOW()
WHERE status = 'new'
  AND source = 'apollo';
