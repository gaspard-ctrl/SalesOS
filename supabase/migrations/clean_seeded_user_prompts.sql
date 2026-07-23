-- One-shot : avant le fix de lib/auth.ts, chaque nouveau compte était seedé avec
-- le guide bot COMPLET dans users.user_prompt, ce qui dupliquait le guide dans le
-- system prompt (guide global + copie perso). On vide les user_prompt qui sont
-- des copies du guide (détectées par sa première phrase distinctive), en gardant
-- les vraies instructions perso.
UPDATE users
SET user_prompt = NULL
WHERE user_prompt LIKE 'Tu es CoachelloGPT, l''assistant IA de l''équipe commerciale de Coachello.%';
