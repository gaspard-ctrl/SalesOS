# SalesOS — Architecture Technique & Infrastructure
### Document Technique Complet · Coachello · Mars 2026

---

## 1. Vue d'Ensemble de l'Architecture

SalesOS repose sur une architecture **3-tiers moderne** : un frontend web, un backend API, et une couche data/IA. L'ensemble est conçu pour être **léger à déployer**, **scalable progressivement**, et **gérable par une petite équipe** sans infra complexe au départ.

```
┌─────────────────────────────────────────────────┐
│               UTILISATEUR (Browser)             │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────┐
│           FRONTEND  (Next.js / Vercel)          │
│     UI · Search Bar · Deal View · Composer      │
└──────────────────────┬──────────────────────────┘
                       │ REST / WebSocket
┌──────────────────────▼──────────────────────────┐
│         BACKEND API  (Node.js / Railway)        │
│   Auth · Orchestration · Prompting · Webhooks   │
└───┬──────────┬──────────┬───────────┬───────────┘
    │          │          │           │
┌───▼──┐  ┌───▼──┐  ┌────▼───┐  ┌───▼────────────┐
│  DB  │  │ Vec- │  │  AI    │  │  CONNECTEURS   │
│Post- │  │ tor  │  │ Layer  │  │  HubSpot       │
│ gres │  │  DB  │  │(Claude)│  │  Slack         │
│      │  │(Pine-│  │        │  │  Granola       │
│      │  │ cone)│  │        │  │  Gmail/Outlook │
└──────┘  └──────┘  └────────┘  │  LinkedIn      │
                                 │  Web Scraper   │
                                 └────────────────┘
```

---

## 2. Stack Technique Recommandée

### Frontend
**Framework : Next.js 14 (App Router)**
Le meilleur choix pour une app interne B2B : rendu hybride (SSR + client), routing puissant, et excellente intégration avec Vercel pour le déploiement. Alternatives viables : Remix, SvelteKit.

**UI : Tailwind CSS + shadcn/ui**
Composants accessibles et customisables rapidement. Idéal pour construire une interface pro sans designer à temps plein.

**State Management : Zustand + React Query (TanStack)**
Zustand pour l'état global léger (user session, filtres), React Query pour la gestion du cache API et les requêtes asynchrones.

**Temps réel : Pusher ou Ably**
Pour les notifications live (alerte concurrence, message Slack reçu) sans avoir à gérer une infra WebSocket soi-même. Coût : ~$0 à ~$49/mois selon le volume.

---

### Backend
**Runtime : Node.js avec Hono ou Fastify**
Hono est un framework ultra-léger, moderne, et compatible edge/serverless. Parfait pour une API REST rapide. Alternative : Python avec FastAPI si l'équipe est plus à l'aise avec Python (meilleure compatibilité avec l'écosystème IA).

**Authentication : Clerk ou Auth0**
Gestion de l'auth sans la coder : magic link, SSO Google Workspace, rôles. Clerk est plus moderne et developer-friendly. Coût : gratuit jusqu'à ~10 000 MAU, puis ~$25/mois.

**Job Queue : BullMQ (Redis)**
Pour les tâches asynchrones lourdes : génération d'emails en batch, synchronisation HubSpot, veille concurrentielle planifiée. Redis managé sur Railway ou Upstash (~$0-$10/mois au départ).

**ORM : Prisma + PostgreSQL**
Prisma simplifie les migrations et requêtes. PostgreSQL pour tout ce qui est relationnel (users, deals, logs d'action).

---

### Couche IA
**LLM principal : Claude 3.5 Sonnet (Anthropic API)**
Le meilleur rapport qualité/prix/vitesse pour les tâches sales : génération d'emails, résumés, extraction d'intent, scoring. Plus fiable que GPT-4 pour le suivi d'instructions longues.

**Pour le Search sémantique : OpenAI text-embedding-3-small**
Embeddings légers et peu coûteux (~$0.02 pour 1M tokens) pour indexer et retrouver des documents par similarité.

**Vector Database : Pinecone (ou pgvector si on reste sur Postgres)**
Pinecone est plus simple à démarrer. pgvector est gratuit et suffisant pour des volumes < 1M documents — à privilégier au début pour réduire les coûts.

**Orchestration IA : Vercel AI SDK ou LangChain.js**
Vercel AI SDK est plus léger et mieux intégré avec Next.js. LangChain pour des pipelines IA plus complexes (agents multi-step). On peut commencer avec Vercel AI SDK et migrer si besoin.

---

### Base de Données
**PostgreSQL** (via Railway ou Supabase) pour les données structurées : utilisateurs, deals, logs, séquences.

**pgvector** (extension Postgres) pour le stockage des embeddings — évite d'ajouter Pinecone au départ et garde la stack simple.

**Redis** (via Upstash, serverless) pour le cache, les sessions, et les job queues.

---

## 3. Hébergement — Options & Recommandations

### Option A — Stack Vercel + Railway ⭐ Recommandée pour commencer

| Composant | Service | Coût estimé/mois |
|---|---|---|
| Frontend (Next.js) | Vercel Pro | $20 |
| Backend API | Railway Starter | $5–$20 |
| PostgreSQL | Railway ou Supabase | $0–$25 |
| Redis (cache/queue) | Upstash | $0–$10 |
| Fichiers/Assets | Cloudflare R2 | $0–$5 |
| **TOTAL INFRA** | | **~$25–$80/mois** |

**Avantages** : déploiement en minutes, zero DevOps, scaling automatique, logs intégrés, CI/CD natif depuis GitHub. Parfait pour un MVP et les 12 premiers mois.

**Limites** : moins de contrôle qu'AWS, coûts qui montent vite si trafic important.

---

### Option B — AWS / GCP (pour scale ou données sensibles)

Si Coachello a des contraintes de souveraineté des données ou anticipe un fort volume :

| Composant | Service AWS | Coût estimé/mois |
|---|---|---|
| Frontend | S3 + CloudFront | $5–$15 |
| Backend | ECS Fargate ou Lambda | $30–$100 |
| Base de données | RDS PostgreSQL (t3.micro) | $15–$30 |
| Redis | ElastiCache | $20–$50 |
| **TOTAL INFRA** | | **~$70–$200/mois** |

**Avantages** : contrôle total, conformité RGPD facilitée, SLA élevés.

**Limites** : courbe d'apprentissage, DevOps requis, over-engineering pour un MVP.

---

### Option C — Supabase (all-in-one BaaS) — Pour aller encore plus vite

Supabase combine PostgreSQL + Auth + Storage + Realtime + API auto-générée. On peut prototyper 80% du backend sans écrire une ligne de backend custom.

| Plan | Coût | Limites |
|---|---|---|
| Free | $0 | 500MB DB, 50k requêtes/mois |
| Pro | $25/mois | 8GB DB, 5M requêtes/mois |
| Team | $599/mois | Usage illimité + SLA |

**Recommandation** : Supabase pour le prototype, migration vers Railway/AWS si la prod dépasse les limites.

---

## 4. Les Connecteurs — Détail Technique

### 🔗 HubSpot

**API type** : REST + Webhooks
**Auth** : OAuth 2.0 (connexion via le compte HubSpot de l'admin)
**Endpoints clés** :
- `GET /crm/v3/objects/contacts` — Récupérer les contacts
- `GET /crm/v3/objects/deals` — Récupérer les deals
- `POST /crm/v3/objects/notes` — Créer des notes
- `PATCH /crm/v3/objects/deals/{id}` — Mettre à jour un deal
- Webhooks pour les changements en temps réel (deal stage changé, contact créé)

**Limites** : 100 requêtes/10 secondes (API Key), 150 requêtes/10 secondes (OAuth Private App). Suffisant pour un usage normal.

**Coût API** : inclus dans l'abonnement HubSpot existant. Pas de surcoût.

**Complexité** : ⭐⭐ (facile) — Documentation excellente, SDK officiel dispo (Node.js).

---

### 🔗 Slack

**API type** : REST + WebSockets (Socket Mode) + Webhooks
**Auth** : OAuth 2.0 via Slack App (à créer dans le Slack workspace Coachello)
**Endpoints clés** :
- `chat.postMessage` — Envoyer un message dans un canal ou DM
- `conversations.history` — Récupérer l'historique d'un canal
- `search.messages` — Rechercher dans les messages (requiert user token)
- `users.info` — Infos sur un utilisateur
- Webhooks entrants pour déclencher des actions depuis SalesOS

**Particularité importante** : La recherche dans les messages (`search.messages`) nécessite un **user token** (pas un bot token). Il faudra donc que chaque utilisateur autorise l'app Slack avec son compte personnel pour accéder à sa recherche.

**Limites** : Tier 3 = 50 requêtes/minute. Tier 2 = 20 req/min. À surveiller pour les opérations en batch.

**Coût API** : gratuit. L'app Slack custom ne coûte rien à créer.

**Complexité** : ⭐⭐⭐ (moyen) — La gestion des tokens user vs bot et des scopes peut être délicate.

---

### 🔗 Granola

**Statut actuel** : Granola n'a pas encore d'API publique officielle documentée (mars 2026).
**Options disponibles** :

1. **Export manuel → Parsing** : Granola permet d'exporter les notes en Markdown/PDF. On peut créer un workflow où l'utilisateur exporte depuis Granola et upload dans SalesOS. Simple mais non automatique.

2. **Clipboard/Extension Chrome** : Une extension Chrome peut capturer le contenu de l'interface Granola et l'envoyer à SalesOS via une API interne. Faisable mais fragile.

3. **Surveiller les updates API Granola** : L'équipe Granola travaille sur des intégrations — à surveiller sur leur roadmap publique. Priorité à monitorer.

4. **Webhook via Zapier/Make** : Granola a une intégration Zapier (beta). On peut déclencher un webhook vers SalesOS à chaque nouvelle note. Solution intermédiaire viable.

**Recommandation court terme** : Intégration via Zapier/Make webhook en attendant une API officielle. Coût Zapier : ~$20-$50/mois.

**Complexité** : ⭐⭐⭐⭐ (difficile pour une intégration native directe)

---

### 🔗 Gmail / Outlook

**Gmail** :
- API : Google Gmail API (REST)
- Auth : OAuth 2.0 via Google Cloud Console
- Endpoints : `messages.list`, `messages.get`, `messages.send`, `threads.list`
- Scopes requis : `gmail.readonly` (lecture) + `gmail.send` (envoi)
- Limites : 1 milliard d'unités de quota/jour. Très généreux.
- Coût : gratuit

**Outlook** :
- API : Microsoft Graph API
- Auth : OAuth 2.0 via Azure AD
- Endpoints similaires (messages, sendMail, etc.)
- Coût : gratuit

**Complexité** : ⭐⭐ (facile) — Deux des APIs les mieux documentées du marché.

---

### 🔗 LinkedIn

**Situation particulière** : LinkedIn est **très restrictif** avec son API officielle depuis 2015.

**Option 1 — LinkedIn API officielle (Marketing Developer Platform)**
Accès limité aux partenaires certifiés. Requiert une approbation et est orientée publicité/recrutement. Pas adapté pour du sales intelligence général.

**Option 2 — Phantombuster (recommandé)**
Service d'automatisation LinkedIn qui expose une API REST propre. Permet de scraper des profils, exporter des connections, récupérer des posts. Coût : $69-$399/mois selon le volume.

**Option 3 — ProxyCurl (recommandé pour les profils)**
API dédiée à l'enrichissement de profils LinkedIn. Tu envoies une URL LinkedIn, ils renvoient les données structurées du profil. Coût : $0.01 par requête (environ $10 pour 1000 profils).

**Option 4 — Clay ou Apollo.io**
Ces outils d'enrichissement exposent eux-mêmes des APIs et intègrent déjà LinkedIn de manière légale. Peut remplacer une intégration LinkedIn directe.

**Recommandation** : ProxyCurl pour l'enrichissement de profils + Phantombuster pour les actions automatisées. Budget : $50-$150/mois.

**Complexité** : ⭐⭐⭐⭐⭐ (difficile en direct) → ⭐⭐ avec ProxyCurl/Phantombuster

---

### 🔗 Veille Concurrentielle (Web)

**Option 1 — Perplexity API**
API de recherche web avec réponses synthétisées. Parfait pour "quelles sont les dernières actus de [concurrent] ?" Coût : ~$5 pour 1000 requêtes (modèle sonar).

**Option 2 — Exa.ai**
Moteur de recherche neural optimisé pour les cas d'usage IA. Renvoie des extraits pertinents. Coût : $10 pour 1000 recherches.

**Option 3 — Google Custom Search API**
100 requêtes/jour gratuites, puis $5 pour 1000 requêtes supplémentaires.

**Option 4 — Brave Search API**
$3 pour 1000 requêtes. Moins de restrictions que Google.

**Recommandation** : Exa.ai pour la recherche sémantique + Brave Search pour le volume. Budget : $20-$50/mois.

---

## 5. Couche IA — Coûts Détaillés

### Anthropic (Claude)

| Modèle | Input | Output | Cas d'usage |
|---|---|---|---|
| Claude 3.5 Sonnet | $3 / 1M tokens | $15 / 1M tokens | Génération emails, résumés, analyse |
| Claude 3 Haiku | $0.25 / 1M tokens | $1.25 / 1M tokens | Tâches simples, classification, routing |
| Claude 3 Opus | $15 / 1M tokens | $75 / 1M tokens | Analyses complexes (usage rare) |

**Estimation mensuelle pour une équipe de 5 commerciaux** :
- 200 emails générés/mois × ~1500 tokens = 300K tokens output → **~$4.50**
- 500 recherches/résumés × ~2000 tokens = 1M tokens output → **~$15**
- 50 briefings meetings × ~3000 tokens = 150K tokens output → **~$2.25**
- **Total IA estimé : ~$20-$50/mois pour 5 utilisateurs**

### OpenAI (Embeddings pour la recherche)
- text-embedding-3-small : **$0.02 / 1M tokens**
- Indexation de 10 000 documents de ~500 tokens = 5M tokens → **$0.10 une seule fois**
- Recherches quotidiennes : négligeable
- **Total embeddings : < $5/mois**

---

## 6. Budget Total Estimé

### Scénario MVP (1-5 utilisateurs, équipe Coachello)

| Poste | Service | Coût/mois |
|---|---|---|
| **Infrastructure** | Vercel Pro + Railway | $25–$50 |
| **Base de données** | Supabase Pro | $25 |
| **Auth** | Clerk | $0–$25 |
| **IA (LLM)** | Anthropic Claude | $20–$50 |
| **Embeddings** | OpenAI | $2–$5 |
| **Recherche web** | Exa.ai + Brave | $20–$50 |
| **LinkedIn enrichissement** | ProxyCurl | $20–$50 |
| **Temps réel (notifs)** | Pusher | $0–$49 |
| **Granola (transition)** | Zapier | $20–$49 |
| **Monitoring** | Sentry (free tier) | $0 |
| **TOTAL** | | **~$130–$350/mois** |

### Scénario Scale (10-30 utilisateurs)

| Poste | Coût/mois |
|---|---|
| Infrastructure (Railway/AWS) | $100–$300 |
| IA (LLM, volume 10x) | $100–$300 |
| Connecteurs & APIs | $100–$200 |
| Auth & services tiers | $50–$100 |
| **TOTAL** | **~$350–$900/mois** |

> 💡 **Ratio de référence** : un outil SaaS B2B comparable coûte $50-$200/utilisateur/mois. SalesOS en interne reviendrait à $15-$30/utilisateur/mois à l'échelle — un avantage économique majeur.

---

## 7. Sécurité & Conformité RGPD

### Authentification & Accès
- OAuth 2.0 pour toutes les intégrations (aucun mot de passe stocké)
- JWT avec expiration courte (15 min) + refresh tokens
- Row-Level Security (RLS) dans Supabase/PostgreSQL pour isoler les données par utilisateur

### Données en transit & au repos
- HTTPS partout (Vercel + Railway activent TLS automatiquement)
- Chiffrement AES-256 pour les tokens API stockés (jamais en clair en base)
- Variables d'environnement via les secret stores des plateformes (pas dans le code)

### RGPD
- Hébergement en **EU West** possible sur Vercel, Railway, et Supabase
- Logs d'accès avec rétention configurable
- Possibilité de purge des données utilisateur sur demande
- Les données HubSpot et Slack ne sont pas stockées en dur dans SalesOS — elles sont **récupérées à la demande et cachées temporairement**

### Tokens OAuth des connecteurs
Les access tokens des utilisateurs (HubSpot, Slack, Gmail) sont chiffrés avec AES-256 avant stockage en base. La clé de chiffrement est stockée dans les variables d'environnement du serveur, jamais en base.

---

## 8. Architecture des Connecteurs — Pattern Technique

Chaque connecteur suit la même structure pour maintenir la cohérence du code :

```typescript
// Pattern standardisé pour chaque connecteur
interface Connector {
  id: string                    // 'hubspot' | 'slack' | 'gmail' | ...
  authenticate(userId: string): Promise<OAuthTokens>
  search(query: string, filters?: SearchFilters): Promise<Document[]>
  fetch(resourceId: string): Promise<Resource>
  action(type: ActionType, payload: any): Promise<ActionResult>
  webhook?: WebhookHandler       // optionnel selon le connecteur
}
```

**Flux de données type pour une recherche unifiée** :
1. Utilisateur tape une query dans SalesOS
2. Backend génère un embedding de la query (OpenAI)
3. Recherche en parallèle dans : pgvector (docs indexés) + HubSpot API + Slack search API
4. Les résultats sont re-rankés par pertinence (cosine similarity + recence)
5. Claude synthétise les top résultats en une réponse narrative
6. Affiché dans l'UI en < 3 secondes

---

## 9. CI/CD & Monitoring

### Pipeline de déploiement
```
GitHub (main branch)
    ↓ Push
GitHub Actions (tests + lint)
    ↓ Si OK
Vercel (frontend) → Deploy automatique
Railway (backend) → Deploy automatique
```

### Monitoring
- **Sentry** : capture des erreurs frontend + backend (free tier suffisant au départ)
- **Vercel Analytics** : performances et Core Web Vitals
- **Railway Metrics** : CPU, RAM, latence de l'API
- **Uptime Kuma** (self-hosted, gratuit) : alertes si le service est down

### Coûts de développement
Pour avoir une estimation honnête :

| Profil | Temps estimé MVP | Coût si freelance |
|---|---|---|
| Fullstack dev senior (Next.js + Node) | 6-8 semaines | $8k–$15k |
| Avec Claude Code / Cursor / Copilot | 3-4 semaines | $4k–$8k |
| En no-code partiel (Supabase + Retool) | 2-3 semaines | $2k–$5k |

> 💡 Avec les outils IA actuels (Cursor + Claude Code), un bon dev peut aller **2x plus vite** qu'il y a 2 ans. Un MVP fonctionnel est réaliste en **3 à 5 semaines**.

---

## 10. Roadmap Technique — Phases

### Phase 0 — Socle (Semaines 1-2)
- [ ] Setup Supabase (DB + Auth)
- [ ] Déploiement Next.js sur Vercel
- [ ] Backend Hono sur Railway
- [ ] Intégration OAuth HubSpot + Slack
- [ ] Interface de recherche basique

### Phase 1 — Core Features (Semaines 3-5)
- [ ] Indexation et embeddings des données HubSpot
- [ ] Recherche unifiée HubSpot + Slack
- [ ] AI Prospecting Writer (Claude API)
- [ ] Envoi de messages Slack depuis l'app
- [ ] Deal Intelligence Panel

### Phase 2 — Intelligence Layer (Semaines 6-10)
- [ ] Intégration Gmail (lecture + envoi)
- [ ] Veille concurrentielle (Exa.ai + alertes)
- [ ] Meeting Prep Briefing (Granola via Zapier)
- [ ] Relationship Health Score
- [ ] Notifications temps réel (Pusher)

### Phase 3 — Scale & Optimisation (Mois 3-6)
- [ ] Intégration LinkedIn (ProxyCurl)
- [ ] Follow-up Autopilot
- [ ] Knowledge Base Sales
- [ ] Métriques d'usage + dashboard admin
- [ ] Migration vers AWS si besoin de compliance RGPD stricte

---

## 11. Décisions Clés à Prendre

Avant de commencer, 4 questions structurantes :

**1. Qui développe ?**
En interne, freelance, ou agence ? Cela impacte la stack choisie (plus ou moins complexe).

**2. Données sensibles ?**
Les données clients/prospects Coachello sont-elles soumises à des contraintes légales qui imposent un hébergement EU strict ? → Si oui, éviter Vercel US et opter pour Railway EU ou AWS Paris.

**3. Volume attendu ?**
5 utilisateurs ou 50 ? Le design de la DB et du caching change significativement selon la réponse.

**4. Priorité des connecteurs ?**
HubSpot + Slack sont les plus critiques et les plus simples. Gmail + Granola en phase 2. LinkedIn uniquement si le use case prospection outbound est prioritaire.

---

## 12. Conclusion Technique

SalesOS est un projet **techniquement accessible** avec le stack moderne disponible en 2026. Les risques principaux ne sont pas techniques mais d'exécution : scope creep, intégrations instables (LinkedIn, Granola), et adoption par l'équipe.

**La recommandation de départ** : Supabase + Vercel + Railway + Claude API + HubSpot + Slack. Ce combo permet d'avoir un MVP fonctionnel pour ~$50/mois d'infra et ~3-4 semaines de dev. On part simple, on ajoute les connecteurs les uns après les autres, et on scale quand le produit prouve sa valeur.

---

*Document technique — Usage interne Coachello · Mars 2026*
