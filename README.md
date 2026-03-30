# SalesOS — Coachello Sales Intelligence

Outil interne pour l'équipe commerciale de Coachello. Connecté à HubSpot, Slack, Gmail, Google Calendar, Google Drive et le web. Propulsé par Claude (Anthropic) pour l'IA.

> **Document de passation** — Ce fichier décrit l'intégralité du projet : fonctionnalités, architecture, base de données, outils externes, et comment modifier chaque partie.

---

## Table des matières

1. [Fonctionnalités](#1-fonctionnalités)
2. [Stack technique](#2-stack-technique)
3. [Outils externes & clés API](#3-outils-externes--clés-api)
4. [Variables d'environnement](#4-variables-denvironnement)
5. [Structure du projet](#5-structure-du-projet)
6. [Pages (interface utilisateur)](#6-pages-interface-utilisateur)
7. [API Routes (backend)](#7-api-routes-backend)
8. [Librairies (lib/)](#8-librairies-lib)
9. [Schéma base de données Supabase](#9-schéma-base-de-données-supabase)
10. [Cron jobs (tâches automatiques)](#10-cron-jobs-tâches-automatiques)
11. [Architecture & flux principaux](#11-architecture--flux-principaux)
12. [Lancer en local](#12-lancer-en-local)
13. [Déploiement](#13-déploiement)
14. [Modifier les fonctionnalités](#14-modifier-les-fonctionnalités)

---

## 1. Fonctionnalités

### CoachelloGPT — Agent IA (page d'accueil `/`)
Agent IA conversationnel polyvalent. Fonctionne en deux modes :
- **Mode CRM** : accès temps réel à HubSpot (contacts, deals, entreprises), Slack (lire/envoyer des messages), Google Drive (recherche et lecture de documents)
- **Mode conseiller** : répond aux questions générales de vente — méthodologie (MEDDIC, SPIN, Challenger Sale...), rédaction d'emails, négociation, coaching commercial, stratégie go-to-market
- **Mode veille** : recherche web en temps réel via Tavily pour les actualités, concurrents, tendances marché

Le bot route automatiquement chaque question vers le bon mode. L'historique des conversations est sauvegardé en base. Chaque utilisateur peut personnaliser son prompt système depuis `/prompt`. Le modèle IA est configurable par utilisateur (Haiku, Sonnet ou Opus).

### Briefing Meetings (`/briefing`)
Prépare automatiquement les réunions à venir en croisant 5 sources de données :
- **Google Calendar** : récupère les 7 prochains jours de meetings (max 50 événements)
- **HubSpot** : contacts associés, deals liés, historique des échanges (notes, emails, appels, réunions)
- **Gmail** : emails récents échangés avec les participants (30 derniers jours)
- **Slack** : mentions du contact ou de l'entreprise dans les canaux pertinents
- **Web (Tavily)** : actualités récentes sur l'entreprise et l'interlocuteur

Génère un briefing structuré par Claude : objectif de la réunion, identité du contact, insights entreprise et interlocuteur, questions à poser, prochaine étape, qualification deal (BANT+).

Si un deal est associé au contact, affiche un encadré compact avec le score IA, le stage, le montant et le raisonnement du scoring.

Actions : envoyer le briefing en DM Slack, télécharger en .txt, régénérer. Cache de 4h pour les données.

### Prospection (`/prospecting`)
- Recherche de contacts HubSpot avec filtres avancés : pays, statut lead, date dernier contact, taille entreprise, source, lifecycle stage
- Recherche en langage naturel (Claude interprète la requête puis filtre HubSpot)
- Carte contact allégée : email inline, badges lifecycle/lead status, mini-timeline CRM (3 dernières activités structurées avec icônes), popup historique complet
- Génération d'emails personnalisés par Claude (contexte utilisateur + données CRM)
- Génération de messages LinkedIn
- Envoi direct via Gmail (OAuth par utilisateur) avec To/CC/BCC et pièces jointes
- Génération en masse (bulk)

### Deals (`/deals`)
- Pipeline Kanban HubSpot filtré (sans Closed Won / Closed Lost)
- Panel détail élargi (65%) avec layout 2 colonnes :
  - **Gauche — "About the deal"** : score IA (6 dimensions avec barres de progression), raisonnement, suggestion d'action
  - **Droite — "Qualification"** : BANT+ (8 champs : budget, autorité, besoin, champion, timeline, fit stratégique...) avec barre de progression
- Contacts et Entreprise côte à côte
- Activité récente encadrée et visible (emails, appels, réunions, notes)
- Scoring IA par Claude (6 dimensions : authority, budget, timeline, need, engagement, strategic fit), stocké en cache Supabase (7 jours)
- Indicateur de santé (vert/orange/rouge) selon date de closing et dernière activité
- Analyse IA approfondie du deal (synthèse, risques, dynamique, signaux positifs/négatifs)
- Génération d'email de suivi par Claude

### Veille Concurrentielle (`/competitive`)
- Ajout/suivi de concurrents avec catégorie (Direct / Indirect / Adjacent)
- Surveillance paramétrable par type : Produit, Funding, Recrutement, Contenu, Pricing
- Analyse IA via Tavily (vraie recherche web) + Claude : signaux de la semaine écoulée
- Feed de signaux flat trié par date, filtrable par type et par concurrent
- Génération de battlecards
- Chat IA sur les données concurrentielles
- Analyse automatique tous les lundis matin (cron)

### Signaux Marché (`/signals`)
- Veille marché automatisée via Tavily
- Scan par entreprise ou scan global de tous les contacts/entreprises
- Signaux contextualisés par rapport aux deals en cours

### Paramètres (`/settings`)
- Statut des intégrations (Claude, Gmail, Google Calendar, HubSpot, Slack)
- Connexion Gmail/Calendar via OAuth Google
- Préférences de modèle IA par fonctionnalité (chat, briefing, scoring, prospection, veille)
- Éditeur de guides : bot, prospection, briefing
- Gestion de la clé API Claude personnelle (assignée par l'admin)

### Prompt (`/prompt`)
- Éditeur de prompt système personnalisé par utilisateur
- Guide envoyé à Claude en tant que system prompt
- Bouton "Charger le prompt par défaut"

### Admin (`/admin`) — Arthur uniquement
- Liste des utilisateurs inscrits
- Assignation des clés API Claude par utilisateur
- Suivi des tokens consommés et coût estimé (mensuel + total)
- Préférences de modèle IA globales
- Gestion des guides par défaut (bot, prospection, briefing)

---

## 2. Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | Next.js App Router | 15+ |
| Language | TypeScript | 5 |
| UI | React | 19 |
| CSS | Tailwind CSS | 4 |
| Auth | Clerk (Google OAuth) | 7 |
| Base de données | Supabase (PostgreSQL) | — |
| IA | Anthropic Claude (Haiku / Sonnet / Opus) | — |
| Icônes | Lucide React | 0.577 |
| Markdown | react-markdown | 10 |
| Hosting | Netlify | — |
| Recherche web | Tavily API | — |

> **Modèle IA** : Le modèle par défaut est `claude-haiku-4-5-20251001`. Il est configurable par utilisateur et par fonctionnalité via la table `guide_defaults` (clé `model_preferences`). Modèles disponibles : Haiku, Sonnet (`claude-sonnet-4-6`), Opus (`claude-opus-4-6`).

---

## 3. Outils externes & clés API

### Anthropic (Claude)
- **Usage** : Agent IA, scoring deals, génération emails, veille concurrentielle, briefings, chat
- **Auth** : Clé API par utilisateur, stockée chiffrée en DB. Clé fallback dans `.env.local` (`ANTHROPIC_API_KEY`)
- **Assigner une clé** : Admin → `/admin` → choisir un utilisateur → coller la clé
- **Où** : `lib/auth.ts` récupère la clé déchiffrée au moment de l'appel

### HubSpot
- **Usage** : CRM — contacts, deals, companies, engagements, pipelines
- **Auth** : Token d'accès privé partagé (`HUBSPOT_ACCESS_TOKEN` dans `.env.local`)
- **API utilisée** : HubSpot CRM v3 (`api.hubapi.com/crm/v3/`)
- **Changer le token** : Régénérer dans HubSpot → Settings → Integrations → Private Apps, puis mettre à jour `.env.local` sur Netlify

### Slack
- **Usage** : Lire les messages de canaux, envoyer des messages depuis l'agent IA
- **Auth** : Bot token partagé (`SLACK_BOT_TOKEN`) + Signing Secret (`SLACK_SIGNING_SECRET`)
- **Créer un bot Slack** : api.slack.com/apps → Create App → Bot Token Scopes : `channels:history`, `channels:read`, `chat:write`, `users:read`

### Gmail & Google Calendar (Google OAuth)
- **Usage** : Envoi d'emails depuis Prospection, récupération des événements calendrier pour les briefings
- **Auth** : OAuth par utilisateur (refresh token chiffré en DB, access token auto-renouvelé)
- **Scopes** : `gmail.send`, `gmail.readonly`, `calendar.readonly`
- **Configurer OAuth** : Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 → Authorized redirect URIs : `{APP_URL}/api/gmail/callback`
- **Variables** : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`

### Google Drive
- **Usage** : Recherche et lecture de documents (présentations, propositions, templates) depuis l'agent IA
- **Auth** : Même OAuth Google que Gmail/Calendar (scope `drive.readonly`)
- **Outils IA** : `search_drive` (recherche par mot-clé), `read_drive_file` (lecture du contenu)

### Tavily
- **Usage** : Recherche web pour la veille concurrentielle, les briefings meetings, et le chat IA (outil `web_search`)
- **Auth** : Clé API dans `.env.local` (`TAVILY_API_KEY`)
- **Obtenir une clé** : app.tavily.com → Dashboard → API Key (1 000 recherches/mois gratuites)
- **Coût** : Gratuit jusqu'à 1 000 req/mois, ensuite ~$0.004/recherche

### Clerk
- **Usage** : Authentification (Google OAuth uniquement)
- **Auth** : Clé publique et secrète dans `.env.local`
- **Configurer** : dashboard.clerk.com → votre application → API Keys
- **Route publique** : `/sign-in` et `/api/gmail/callback`

### Supabase
- **Usage** : Base de données PostgreSQL (utilisateurs, conversations, scores, signaux, briefings...)
- **Auth** : Service role key (accès admin complet depuis les API routes)
- **Variables** : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## 4. Variables d'environnement

Fichier : `.env.local` (local) / Variables d'environnement Netlify (production)

```env
# Clerk — Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Supabase — Base de données
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Chiffrement AES-256 (64 caractères hexadécimaux)
ENCRYPTION_SECRET=

# Anthropic Claude (clé fallback si l'utilisateur n'en a pas)
ANTHROPIC_API_KEY=sk-ant-...

# HubSpot CRM
HUBSPOT_ACCESS_TOKEN=pat-...

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=

# Google OAuth (Gmail + Calendar + Drive)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=https://votre-app.netlify.app

# Tavily (veille + briefings + chat web search)
TAVILY_API_KEY=tvly-...
```

> Ne jamais committer `.env.local`. Il est dans `.gitignore`.

---

## 5. Structure du projet

```
app/
  page.tsx                          # CoachelloGPT (chat IA)
  briefing/page.tsx                 # Briefing meetings (calendrier + préparation)
  deals/page.tsx                    # Pipeline Kanban + scoring + analyse
  prospecting/page.tsx              # Recherche contacts + email + LinkedIn
  competitive/page.tsx              # Veille concurrentielle
  signals/page.tsx                  # Signaux marché
  prompt/page.tsx                   # Éditeur de prompt
  settings/page.tsx                 # Intégrations + préférences modèle
  admin/page.tsx                    # Admin (utilisateurs + clés + usage)
  sign-in/[[...sign-in]]/page.tsx   # Page de connexion (Clerk)

  api/
    chat/route.ts                   # Agent IA streaming (HubSpot + Slack + Drive + Web)
    conversations/route.ts          # CRUD conversations
    conversations/[id]/route.ts     # Conversation individuelle
    conversations/[id]/messages/route.ts  # Sauvegarde messages + titre auto

    briefing/gather/route.ts        # Collecte données briefing (HubSpot + Gmail + Slack + Web)
    briefing/synthesize/route.ts    # Synthèse briefing par Claude
    briefing/send-slack/route.ts    # Envoi briefing en DM Slack

    calendar/events/route.ts        # Événements Google Calendar (7 jours)
    calendar/status/route.ts        # Statut connexion Calendar

    gmail/connect/route.ts          # OAuth Google — initiation
    gmail/callback/route.ts         # OAuth Google — callback
    gmail/send/route.ts             # Envoyer un email
    gmail/status/route.ts           # Statut connexion Gmail

    deals/list/route.ts             # Liste deals HubSpot + scores cachés
    deals/details/route.ts          # Détail deal + contacts + engagements
    deals/score/route.ts            # Scorer un deal (Claude)
    deals/score-all/route.ts        # Scorer tous les deals (cron)
    deals/analyze/route.ts          # Analyser un deal (Claude)
    deals/generate-email/route.ts   # Générer email de suivi (Claude)

    prospection/search/route.ts     # Recherche contacts HubSpot
    prospection/details/route.ts    # Détail contact HubSpot
    prospection/generate/route.ts   # Génération email IA
    prospection/generate-bulk/route.ts  # Génération email bulk
    prospection/ai-search/route.ts  # Recherche NL → HubSpot

    competitive/competitors/route.ts         # CRUD concurrents
    competitive/competitors/[id]/route.ts    # Modifier/supprimer concurrent
    competitive/signals/route.ts             # Lire les signaux
    competitive/analyze/route.ts             # Analyser un concurrent (Tavily + Claude)
    competitive/analyze-all/route.ts         # Analyser tous (cron)
    competitive/chat/route.ts                # Chat sur les concurrents
    competitive/battlecard/route.ts          # Générer une battlecard

    market/scan/route.ts            # Scan marché pour une entreprise
    market/scan-all/route.ts        # Scan marché global
    market/signals/route.ts         # Signaux marché
    market/company-context/route.ts # Contexte entreprise
    market/contacts-web/route.ts    # Enrichissement contacts web
    market/contact-details/route.ts # Détail contact marché

    linkedin/message/route.ts       # Génération message LinkedIn
    settings/bot-guide/route.ts     # Guide bot (get/save)
    settings/briefing-guide/route.ts # Guide briefing (get/save)
    settings/guide/route.ts         # Guide générique (get/save)
    user/me/route.ts                # Infos utilisateur courant
    admin/users/route.ts            # Liste utilisateurs (admin)
    admin/set-key/route.ts          # Assigner clé Claude (admin)

lib/
  auth.ts                 # getAuthenticatedUser() — Clerk + Supabase
  db.ts                   # Client Supabase (lazy init)
  crypto.ts               # Chiffrement AES-256-GCM
  gmail.ts                # Refresh token Gmail + construction MIME
  google-calendar.ts      # Récupération événements Google Calendar
  log-usage.ts            # Logging usage Claude → usage_logs
  deal-scoring.ts         # Algorithme de scoring deals (3 modèles, 6 dimensions)
  guides/bot.ts           # Prompt système par défaut (DEFAULT_BOT_GUIDE)
  default-briefing-guide.ts  # Guide briefing par défaut
  admin.ts                # Vérification droits admin
  utils.ts                # Utilitaires divers

components/
  sidebar.tsx             # Navigation principale
  coming-soon.tsx         # Placeholder pages futures

middleware.ts             # Clerk auth middleware
```

---

## 6. Pages (interface utilisateur)

### `/` — CoachelloGPT
Chat IA polyvalent en temps réel. L'agent peut :
- Consulter les données CRM (HubSpot : deals, contacts, entreprises)
- Rechercher et lire des documents Google Drive
- Lire et envoyer des messages Slack
- Rechercher sur le web (actualités, concurrents, tendances)
- Répondre à des questions de méthodologie commerciale, coaching, rédaction

Sidebar avec historique des conversations. Chaque réponse est streamée. Suggestions rapides : "Quels deals sont à risque ?", "Rédige un cold email", "Explique la méthode MEDDIC", etc.

**Modifier l'agent** : `app/api/chat/route.ts` — outils dans `tools[]`, prompt dans `lib/guides/bot.ts`

### `/briefing` — Briefing Meetings
Vue calendrier 7 jours (Google Calendar). Clic sur un meeting externe lance la collecte multi-source (HubSpot, Gmail, Slack, Tavily) puis la synthèse Claude. Layout 3 panneaux :
- **Gauche** : liste des meetings (vue calendrier ou liste compacte)
- **Centre** : briefing (objectif, identité contact, entreprise, interlocuteur, deal associé avec score, actualités, questions à poser)
- **Droite** : contexte de la relation, signaux d'attention, prochaine étape, qualification deal, boutons d'action

**Modifier le briefing** : `app/api/briefing/gather/route.ts` (collecte) + `app/api/briefing/synthesize/route.ts` (synthèse Claude)

### `/prospecting` — Prospection
Deux modes : recherche manuelle avec filtres et recherche en langage naturel. Carte contact avec mini-timeline CRM structurée (3 dernières activités avec icônes). Génération email/LinkedIn par Claude. Envoi via Gmail.

**Modifier les filtres** : `app/api/prospection/search/route.ts`
**Modifier la génération d'email** : `app/api/prospection/generate/route.ts`

### `/deals` — Deals
Kanban par stage HubSpot. Panel détail 65% avec scoring et qualification côte à côte. Contacts et entreprise côte à côte. Activité récente encadrée. Analyse IA approfondie.

**Modifier le scoring** : `app/api/deals/score/route.ts`
**Modifier l'analyse** : `app/api/deals/analyze/route.ts`

### `/competitive` — Veille Concurrentielle
Liste concurrents à gauche, feed signaux à droite. Filtres par type et concurrent. Analyse Tavily + Claude. Chat IA. Battlecards.

**Modifier les recherches** : `app/api/competitive/analyze/route.ts`

### `/signals` — Signaux Marché
Veille marché automatisée. Scan par entreprise ou global.

### `/settings` — Paramètres
Intégrations, préférences de modèle IA par fonctionnalité, éditeurs de guides.

### `/prompt` — Prompt
Éditeur de prompt système personnalisé. Sauvegardé en DB.

### `/admin` — Admin
Gestion utilisateurs, clés API, usage tokens, guides par défaut, préférences modèle globales.

---

## 7. API Routes (backend)

### Chat & Conversations

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/chat` | POST | Agent IA streaming (SSE). Outils : HubSpot, Slack, Drive, web_search. Max 8192 tokens output. |
| `/api/conversations` | GET/POST | Liste (30 dernières) / Créer |
| `/api/conversations/[id]` | GET/DELETE | Messages / Supprimer |
| `/api/conversations/[id]/messages` | POST | Sauvegarder messages + titre auto |

### Briefing

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/briefing/gather` | POST | Collecte multi-source (HubSpot + Gmail + Slack + Tavily + deal_scores). Cache 4h. |
| `/api/briefing/synthesize` | POST | Synthèse Claude → briefing structuré JSON |
| `/api/briefing/send-slack` | POST | Envoi briefing en DM Slack |

### Calendar

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/calendar/events` | GET | Événements Google Calendar (param `days`, défaut 7, max 50 résultats) |
| `/api/calendar/status` | GET | Statut connexion Calendar |

### Gmail

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/gmail/status` | GET | `{ connected: boolean }` |
| `/api/gmail/connect` | GET | Redirige vers Google OAuth |
| `/api/gmail/callback` | GET | Callback OAuth — stocke le refresh token chiffré |
| `/api/gmail/send` | POST | `{ to, cc, bcc, subject, body, attachments[] }` |

### Prospection

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/prospection/search` | GET | Filtres : `q, lifecycle, country, leadStatus, lastContactBefore, employeeRange, source, sortBy` |
| `/api/prospection/details` | GET | Détail contact HubSpot + historique CRM structuré |
| `/api/prospection/generate` | POST | Génération email Claude |
| `/api/prospection/generate-bulk` | POST | Génération email bulk |
| `/api/prospection/ai-search` | POST | Recherche NL → HubSpot |

### Deals

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/deals/list` | GET | Deals actifs + scores cachés |
| `/api/deals/details` | GET | Deal + contacts + entreprise + engagements + score |
| `/api/deals/score` | POST | Score Claude (6 dimensions) + cache `deal_scores` |
| `/api/deals/score-all` | POST | Score tous les deals (cron) |
| `/api/deals/analyze` | POST | Analyse approfondie Claude |
| `/api/deals/generate-email` | POST | Email de suivi Claude |

### Veille Concurrentielle

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/competitive/competitors` | GET/POST | CRUD concurrents |
| `/api/competitive/competitors/[id]` | PATCH/DELETE | Modifier/supprimer |
| `/api/competitive/signals` | GET | Tous les signaux |
| `/api/competitive/analyze` | POST | Tavily + Claude → signaux |
| `/api/competitive/analyze-all` | POST | Analyse tous (cron) |
| `/api/competitive/chat` | POST | Chat IA streaming sur les concurrents |
| `/api/competitive/battlecard` | POST | Génère une battlecard |

### Market Intelligence

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/market/scan` | POST | Scan marché pour une entreprise |
| `/api/market/scan-all` | POST | Scan global |
| `/api/market/signals` | GET | Signaux marché |
| `/api/market/company-context` | POST | Contexte entreprise |
| `/api/market/contacts-web` | POST | Enrichissement contacts web |

### Settings & Admin

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/user/me` | GET | Infos utilisateur courant |
| `/api/settings/bot-guide` | GET/POST | Guide bot (get/save) |
| `/api/settings/briefing-guide` | GET/POST | Guide briefing (get/save) |
| `/api/admin/users` | GET | Liste utilisateurs + usage |
| `/api/admin/set-key` | POST | Assigner clé Claude |
| `/api/linkedin/message` | POST | Génération message LinkedIn |

---

## 8. Librairies (lib/)

### `auth.ts` — Authentification
`getAuthenticatedUser()` : Clerk → DB → clé Claude déchiffrée. Premier login : crée le compte.

### `db.ts` — Client Supabase
Client lazy-initialisé avec service role key.

### `crypto.ts` — Chiffrement
AES-256-GCM. Pour clés API Claude et refresh tokens OAuth.

### `gmail.ts` — Gmail OAuth
`getGmailAccessToken()` : auto-refresh. `buildRawEmail()` : MIME base64url.

### `google-calendar.ts` — Google Calendar
`getCalendarEvents(userId, days)` : récupère les événements via Google Calendar API (max 50 résultats).

### `log-usage.ts` — Logging IA
`logUsage()` : fire-and-forget dans `usage_logs`.

### `deal-scoring.ts` — Scoring deals
3 modèles (Generic, Human Coaching, AI Coaching), 6 dimensions :
1. Authority & Buying Group (max 25 pts)
2. Budget Clarity (max 15 pts)
3. Timeline Certainty (max 15 pts)
4. Business Need Strength (max 20 pts)
5. Engagement & Momentum (max 15 pts)
6. Strategic Fit (max 10 pts)

Score total /100. Reliability 0–5. Helpers UI : `scoreBadge()`, `reliabilityLabel()`, `healthIndicator()`.

### `guides/bot.ts` — Prompt système
`DEFAULT_BOT_GUIDE` : prompt par défaut de CoachelloGPT avec routing (données/général/mixte/veille), liste des outils, canaux Slack, équipe commerciale.

---

## 9. Schéma base de données Supabase

> Toute modification du schéma se fait manuellement via le SQL Editor de Supabase.

```sql
-- Utilisateurs (synchronisé avec Clerk)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  user_prompt TEXT,
  hubspot_owner_id TEXT,
  slack_display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clés API par utilisateur (Claude)
CREATE TABLE user_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(user_id, service)
);

-- Intégrations OAuth (Gmail, Calendar, Drive)
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_refresh TEXT,
  refresh_iv TEXT,
  refresh_auth_tag TEXT,
  access_token TEXT,
  token_expiry TIMESTAMPTZ,
  connected BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(user_id, provider)
);

-- Logs de consommation IA
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  feature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations chat IA
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages des conversations
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  api_history JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scores IA des deals (cache 7 jours)
CREATE TABLE deal_scores (
  deal_id TEXT PRIMARY KEY,
  score JSONB NOT NULL,
  reasoning TEXT,
  next_action TEXT,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Concurrents suivis
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  category TEXT NOT NULL DEFAULT 'direct',
  description TEXT,
  monitor_hiring BOOLEAN DEFAULT TRUE,
  monitor_products BOOLEAN DEFAULT TRUE,
  monitor_funding BOOLEAN DEFAULT TRUE,
  monitor_content BOOLEAN DEFAULT TRUE,
  monitor_pricing BOOLEAN DEFAULT TRUE,
  battlecard TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Signaux de veille concurrentielle
CREATE TABLE competitive_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  signal_date TEXT,
  confidence TEXT DEFAULT 'medium',
  source_url TEXT,
  linkedin_suggestion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guides par défaut (prompts globaux)
CREATE TABLE guide_defaults (
  key TEXT PRIMARY KEY,
  content TEXT NOT NULL
);
-- Clés : 'bot', 'prospection', 'briefing', 'model_preferences'

-- Cache briefings meetings
CREATE TABLE meeting_briefings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_title TEXT,
  attendee_emails TEXT[],
  raw_data JSONB,
  briefing JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);
```

---

## 10. Cron jobs (tâches automatiques)

| Endpoint | Planning | Description |
|----------|----------|-------------|
| `/api/deals/score-all` | Dimanche 22h UTC | Score tous les deals ouverts. Deals scorés il y a < 7 jours ignorés. |
| `/api/competitive/analyze-all` | Lundi 7h UTC | Analyse tous les concurrents (Tavily + Claude). |

**Authentification** : `Authorization: Bearer $CRON_SECRET` ou session utilisateur valide.

---

## 11. Architecture & flux principaux

### Flux agent IA (chat)
```
Frontend → POST /api/chat (SSE streaming)
→ Claude reçoit prompt système + historique
→ Routing automatique : données (HubSpot/Slack/Drive) | général | web (Tavily)
→ Boucle agentic : tool_use → execute → résultat → Claude → ...
→ Stream : { type: "tool" | "text" | "history" | "done" }
→ Sauvegarde conversation + logUsage()
```

### Flux briefing meeting
```
Sélection d'un meeting → POST /api/briefing/gather
→ En parallèle : HubSpot (contacts + deals + scores + engagements) | Gmail | Slack | Tavily
→ Cache 4h dans meeting_briefings
→ POST /api/briefing/synthesize
→ Claude génère le briefing structuré (JSON)
→ Affichage 3 panneaux
```

### Flux scoring deals
```
Cron dimanche OU bouton "Rescorer"
→ POST /api/deals/score { dealId }
→ HubSpot : deal + contacts + engagements
→ Claude : 6 dimensions + reasoning + next_action + qualification
→ Upsert deal_scores + logUsage()
```

### Flux veille concurrentielle
```
Cron lundi OU bouton "Analyser"
→ POST /api/competitive/analyze { competitorId }
→ 5-6 recherches Tavily en parallèle
→ Claude extrait signaux factuels
→ DELETE anciens + INSERT nouveaux dans competitive_signals
```

---

## 12. Lancer en local

```bash
git clone <repo-url>
cd SalesOS
npm install
cp .env.local.example .env.local  # Remplir toutes les valeurs
npm run dev                        # → http://localhost:3000
```

> Sans `HUBSPOT_ACCESS_TOKEN`, les pages Deals/Prospection/Briefing ne fonctionneront pas. Sans `ANTHROPIC_API_KEY`, le chat ne fonctionnera pas.

---

## 13. Déploiement

```bash
npm run build   # Vérifier que le build passe
git add .
git commit -m "description"
git push origin main
# Netlify déploie automatiquement depuis main
```

**Variables Netlify** : Site settings → Environment variables → toutes les variables de la section 4.

---

## 14. Modifier les fonctionnalités

### Changer le modèle IA
Via `/settings` → Préférences de modèle, ou directement dans `guide_defaults` (clé `model_preferences`).

### Ajouter un outil à l'agent IA
Fichier : `app/api/chat/route.ts`
1. Ajouter dans `tools[]` (name, description, input_schema)
2. Ajouter le `case` dans `executeTool()`
3. Ajouter le label dans `TOOL_LABELS` côté frontend (`app/page.tsx`)

### Modifier le scoring des deals
Fichier : `app/api/deals/score/route.ts` — prompt Claude avec les 6 dimensions.

### Modifier le briefing
- Collecte : `app/api/briefing/gather/route.ts`
- Synthèse : `app/api/briefing/synthesize/route.ts`
- Guide : `lib/default-briefing-guide.ts`

### Modifier les signaux concurrentiels
Fichier : `app/api/competitive/analyze/route.ts` — requêtes Tavily + prompt Claude.

### Ajouter une nouvelle page
1. Créer `app/nouvelle-page/page.tsx`
2. Ajouter le lien dans `components/sidebar.tsx`
3. Créer les routes API dans `app/api/`

---

*Coachello · SalesOS · Interne · Confidentiel · Mars 2026*
