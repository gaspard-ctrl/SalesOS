# Netrows API - Documentation

> **Base URL:** `https://api.netrows.com/v1`
> **Version:** 2.8.0 | OAS 3.1.0
> **Description:** Professional Data Enrichment API - 250+ endpoints across LinkedIn, X (Twitter), TikTok, Instagram, Facebook, Crunchbase, Glassdoor, et 25+ sources.

---

## Authentification

Toutes les requetes necessitent un Bearer Token dans le header :

```
Authorization: Bearer YOUR_API_KEY
```

---

## Rate Limits (par compte)

| Plan | Prix | Requetes/min | Credits/mois | Overage |
|------|------|-------------|--------------|---------|
| Starter | 49 EUR/mois | 50 | - | 0.006 EUR/credit |
| Growth | 299 EUR/mois | 150 | - | 0.004 EUR/credit |
| Enterprise | 1 299 EUR/mois | 500 | - | 0.003 EUR/credit |

---

## Credits

La plupart des appels coutent **1 credit**. Exceptions :

| Endpoint | Credits |
|----------|---------|
| Company Insights (LinkedIn) | 10 |
| Crunchbase (Person/Company) | 5 |
| Glassdoor (Company) | 5 |
| Email Finder (by-name, by-domain, by-linkedin) | 5 |
| Email Finder (decision-maker) | 10 |
| X (Twitter) endpoints | 1-50 (selon volume) |
| Airbnb, Booking.com, TripAdvisor, Yelp | 5 |
| Majestic SEO, SimilarWeb, Wellfound, Zillow | 5 |
| GitHub, Substack, TradingView, Shopify, YouTube | 1 |

> Les credits sont debites meme si le resultat est "not found".

---

## Radar Monitoring

Surveillance continue de profils LinkedIn, profils X et entreprises avec notifications webhook.

### Webhook Payload

**Headers envoyes :**

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `User-Agent` | `Netrows-Webhook/1.0` |
| `X-Netrows-Event` | `profile.changed` ou `company.changed` |
| `X-Netrows-Timestamp` | ISO 8601 |
| `X-Netrows-Signature` | HMAC-SHA256 (si secret configure) |

**Payload profile.changed :**
```json
{
  "event": "profile.changed",
  "timestamp": "2026-03-24T12:00:00.000Z",
  "profile": {
    "username": "johndoe",
    "url": "https://linkedin.com/in/johndoe"
  },
  "changes": [
    {
      "field": "headline",
      "oldValue": "Software Engineer at Company A",
      "newValue": "Senior Engineer at Company B"
    }
  ],
  "summary": "1 field changed: headline",
  "newSnapshot": {}
}
```

**Payload company.changed :**
```json
{
  "event": "company.changed",
  "timestamp": "2026-03-24T12:00:00.000Z",
  "company": {
    "username": "acme-corp",
    "url": "https://linkedin.com/company/acme-corp"
  },
  "changes": [
    {
      "field": "staffCount",
      "oldValue": 150,
      "newValue": 165
    }
  ],
  "summary": "1 field changed: staffCount",
  "newSnapshot": {}
}
```

**Champs surveilles :** Tous les champs du snapshot sauf metadata (`id`, `urn`, `entityUrn`, `trackingId`). Pour les entreprises, `logo` et `backgroundCoverImage` sont aussi ignores.

**Verification de signature :**
```js
const crypto = require('crypto');
const signature = req.headers['x-netrows-signature'];
const expected = crypto
  .createHmac('sha256', YOUR_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');
if (signature === expected) { /* valid */ }
```

### Endpoints Radar

#### Profils LinkedIn

| Methode | Endpoint | Description | Credits |
|---------|----------|-------------|---------|
| `GET` | `/radar/profiles` | Lister les profils surveilles | Gratuit |
| `POST` | `/radar/profiles` | Ajouter un profil a surveiller | 1 (fetch initial) |
| `PATCH` | `/radar/profiles/{id}` | Activer/desactiver la surveillance | Gratuit |
| `DELETE` | `/radar/profiles/{id}` | Retirer un profil | Gratuit |

**POST body :** `{ "username": "linkedin-username" }`
**PATCH body :** `{ "is_active": true/false }`

#### Profils X (Twitter)

| Methode | Endpoint | Description | Credits |
|---------|----------|-------------|---------|
| `GET` | `/radar/x-profiles` | Lister les profils X surveilles | Gratuit |
| `POST` | `/radar/x-profiles` | Ajouter un profil X | 1 (fetch initial) |
| `PATCH` | `/radar/x-profiles/{id}` | Activer/desactiver | Gratuit |
| `DELETE` | `/radar/x-profiles/{id}` | Retirer un profil X | Gratuit |

**POST body :** `{ "username": "x-username" }`

#### Entreprises

| Methode | Endpoint | Description | Credits |
|---------|----------|-------------|---------|
| `GET` | `/radar/companies` | Lister les entreprises surveillees | Gratuit |
| `POST` | `/radar/companies` | Ajouter une entreprise | 1 (fetch initial) |
| `PATCH` | `/radar/companies/{id}` | Activer/desactiver | Gratuit |
| `DELETE` | `/radar/companies/{id}` | Retirer une entreprise | Gratuit |

**POST body :** `{ "username": "company-username" }`

---

## LinkedIn - People

### GET `/people/profile` - Profil par username

```bash
curl "https://api.netrows.com/v1/people/profile?username=chandra-dunn" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Params :** `username` (required) - LinkedIn username

**Response :** Profil complet (id, urn, username, firstName, lastName, isPremium, profilePicture, backgroundImage, summary, headline, geo, educations[], position[], skills[], certifications[], honors[], projects{})

---

### GET `/people/profile-by-url` - Profil par URL

```bash
curl "https://api.netrows.com/v1/people/profile-by-url?url=https://www.linkedin.com/in/williamhgates" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Params :** `url` (required) - URL complete du profil LinkedIn

**Response :** Identique a `/people/profile`

---

### GET `/people/search` - Recherche de profils

```bash
curl "https://api.netrows.com/v1/people/search?keywordTitle=Software%20Engineer&company=Microsoft&geo=102277331&start=0" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Params (tous optionnels sauf au moins un) :**

| Param | Description |
|-------|-------------|
| `firstName` | Prenom |
| `lastName` | Nom |
| `keywords` | Mots-cles generaux |
| `geo` | LinkedIn geo ID (ex: "102277331" pour San Francisco) |
| `keywordTitle` | Titre de poste |
| `schoolId` | ID d'ecole LinkedIn |
| `keywordSchool` | Nom d'ecole |
| `company` | Nom d'entreprise |
| `start` | Offset de pagination (commence a 0) |

> Eviter les caracteres speciaux `()`, `/`, `,` dans les parametres de recherche.

**Response :** `{ data: [{ username, firstName, lastName, headline, profilePicture, location, summary }], paging: { total, start, count } }`

---

### GET `/people/reverse-lookup` - Recherche par email pro

```bash
curl "https://api.netrows.com/v1/people/reverse-lookup?email=john.doe@microsoft.com" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Params :** `email` (required) - Email professionnel uniquement (pas Gmail, Yahoo, Outlook)

**Response :** `{ found, email, linkedinUrl, profile: { fullName, headline, summary, profilePicture, location, profileURL, username } }`

---

### GET `/people/activity-time` - Derniere activite

```bash
curl "https://api.netrows.com/v1/people/activity-time?username=williamhgates" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Params :** `username` (required) - Username ou URL

**Response :** `{ data: { date, recentActivity, timestamp, type } }`

> Utiliser `timestamp` ou `date` pour la logique. `recentActivity` est un cache LinkedIn, peut etre obsolete.

---

### GET `/people/connection-count` - Connexions et followers

```bash
curl "https://api.netrows.com/v1/people/connection-count?url=williamhgates" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Params :** `url` (required) - Username ou URL complete

**Response :** `{ connectionCount, followerCount, isInfluencer }`

---

### GET `/people/recommendations/received` - Recommandations recues

**Params :** `url` (required), `start` (optionnel)

### GET `/people/recommendations/given` - Recommandations donnees

**Params :** `url` (required), `start` (optionnel)

---

### GET `/people/likes` - Reactions / Likes du profil

**Params :** `url` (required), `start` (optionnel), `paginationToken` (optionnel)

**Response :** `{ reactions: [{ postUrn, reactionType, reactedAt, post: { author, text, postedAt } }], paging }`

---

### GET `/people/about` - Metadata du profil

**Params :** `url` (required)

**Response :** `{ isVerified, isPremium, isInfluencer, isOpenToWork, isHiring, profileCompleteness, memberSince, lastUpdated }`

---

### GET `/people/position-skills` - Competences par poste

**Params :** `url` (required)

**Response :** `{ positions: [{ companyName, title, startDate, endDate, skills[] }] }`

---

### Interests du profil

| Endpoint | Description | Params |
|----------|-------------|--------|
| `GET /people/interests/companies` | Entreprises suivies | `url`, `page` |
| `GET /people/interests/top-voices` | Top Voices suivis | `url` |
| `GET /people/interests/groups` | Groupes LinkedIn | `url`, `page` |
| `GET /people/interests/schools` | Ecoles suivies | `url`, `page` |
| `GET /people/interests/newsletters` | Newsletters suivies | `url`, `page` |

---

### GET `/people/similar-profiles` - Profils similaires

**Params :** `username` ou `url` (l'un des deux requis)

**Response :** Liste de profils similaires avec username, headline, location, connectionCount

---

### GET `/people/posted-jobs` - Offres publiees par le profil

**Params :** `url` (required)

---

## LinkedIn - Companies

### GET `/companies/details` - Details par username

```bash
curl "https://api.netrows.com/v1/companies/details?username=microsoft" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Params :** `username` (required) - Username ou URL complete

**Response :**
```json
{
  "success": true,
  "username": "microsoft",
  "name": "Microsoft",
  "tagline": "...",
  "description": "...",
  "website": "https://www.microsoft.com",
  "industry": "Computer Software",
  "companySize": "10001+",
  "headquarters": "Redmond, Washington, United States",
  "founded": 1975,
  "specialties": ["Cloud Computing", "AI", "..."],
  "employeeCount": 220000,
  "followerCount": 15000000,
  "logo": "https://...",
  "locations": [{ "country": "...", "city": "...", "isPrimary": true }]
}
```

---

### GET `/companies/by-id` - Details par ID

**Params :** `id` (required) - ID numerique LinkedIn

---

### GET `/companies/search` - Recherche d'entreprises

```bash
curl "https://api.netrows.com/v1/companies/search?keyword=software&locations=102277331&companySizes=C,D&hasJobs=true&industries=4&page=1" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Params (tous required) :**

| Param | Description |
|-------|-------------|
| `keyword` | Mot-cle de recherche |
| `locations` | Geo IDs LinkedIn separes par virgule |
| `companySizes` | Tailles : A (1-10), B (11-50), C (51-200), D (201-500), E (501-1000), F (1001-5000), G (5001-10000), H (10001+) |
| `hasJobs` | `true/false` - filtrer les entreprises avec des offres actives |
| `industries` | IDs d'industrie LinkedIn separes par virgule |
| `page` | Numero de page (commence a 1) |

---

### GET `/companies/jobs` - Offres d'emploi d'une entreprise

**Params :** `companyIds` (required, comma-separated), `page` (optionnel), `sort` (optionnel : `mostRecent`, `oldest`, `mostRelevant`)

---

### GET `/companies/by-domain` - Entreprise par domaine

```bash
curl "https://api.netrows.com/v1/companies/by-domain?domain=microsoft.com" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Params :** `domain` (required)

**Response :** `{ company: { username, name, id, industry, employeeCount, headquarters } }`

---

### GET `/companies/insights` - Insights Premium (10 credits)

```bash
curl "https://api.netrows.com/v1/companies/insights?url=microsoft" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Params :** `url` (required) - Username ou URL

**Response :** employeeGrowth (lastMonth, lastQuarter, lastYear), hiringTrends (activeJobs, topHiringLocations, topHiringRoles), demographics (topSchools, averageTenure, functionBreakdown)

---

### GET `/companies/employees-count` - Employes par localisation

**Params :** `companyId` (required), `locations` (optionnel, geo IDs)

### GET `/companies/jobs-count` - Nombre d'offres actives

**Params :** `companyId` (required)

### GET `/companies/affiliated-pages` - Pages affiliees

**Params :** `url` (required)

### GET `/companies/similar` - Entreprises similaires

**Params :** `username` (required)

---

## LinkedIn - Jobs

| Endpoint | Description | Params |
|----------|-------------|--------|
| `GET /jobs/search` | Recherche d'offres | keywords, location, etc. |
| `GET /jobs/details` | Details d'une offre | jobId |
| `GET /jobs/hiring-team` | Equipe de recrutement | jobId |

---

## LinkedIn - Posts

| Endpoint | Description | Params |
|----------|-------------|--------|
| `GET /people/posts` | Posts d'un profil | url, start, paginationToken |
| `GET /people/post` | Detail d'un post | url (post URL) |
| `GET /people/post-comments` | Commentaires d'un post perso | url, start, sort |
| `GET /people/comments` | Commentaires ecrits par un profil | url, start |
| `GET /companies/posts` | Posts d'une entreprise | url, start, paginationToken |
| `GET /companies/post-comments` | Commentaires sur post entreprise | url, start, sort |
| `GET /posts/search` | Recherche de posts | keyword, sortBy, datePosted |
| `GET /posts/search-by-hashtag` | Posts par hashtag | hashtag |
| `GET /posts/reposts` | Reposts d'un post | url |
| `GET /posts/reactions` | Reactions sur un post | url, start |

---

## LinkedIn - Articles

| Endpoint | Params |
|----------|--------|
| `GET /articles/user-articles` | url, start |
| `GET /articles/details` | url |
| `GET /articles/comments` | url, start |
| `GET /articles/reactions` | url, start |

---

## LinkedIn - Ads

| Endpoint | Description | Params |
|----------|-------------|--------|
| `GET /ads/company` | Pubs actives d'une entreprise | companyId |
| `GET /ads/details` | Details d'une pub | adId |

---

## LinkedIn - Locations

| Endpoint | Description | Params |
|----------|-------------|--------|
| `GET /locations/search` | Recherche de geo IDs | keyword |

---

## Glassdoor

### GET `/glassdoor/company` - Reviews & Data (5 credits)

```bash
curl "https://api.netrows.com/v1/glassdoor/company?url=https://www.glassdoor.com/Overview/Working-at-Stripe-EI_IE671932.11,17.htm" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response :** name, description, yearFounded, headquarters, size, industry, ceo, ratings (overallRating, cultureAndValues, workLifeBalance, compensationAndBenefits, seniorManagement, ceoApproval, recommendToFriend, businessOutlook), counts, competitors, certifications

### GET `/glassdoor/salaries` - Salaires (1 credit)

**Params :** `url` (required) - URL Glassdoor salaires

**Response :** `{ salaries: [{ jobTitle, salaryCount, salaryRange, minSalary, maxSalary, payPeriod }] }`

### GET `/glassdoor/interviews` - Interviews (1 credit)

**Params :** `url` (required) - URL Glassdoor

---

## Crunchbase

### GET `/crunchbase/person` - Profil fondateur (5 credits)

### GET `/crunchbase/company` - Donnees entreprise (5 credits)

---

## Email Finder

| Endpoint | Description | Credits |
|----------|-------------|---------|
| `GET /email-finder/by-name` | Trouver email par nom + entreprise | 5 |
| `GET /email-finder/by-domain` | Emails par domaine | 5 |
| `GET /email-finder/by-linkedin` | Email depuis profil LinkedIn | 5 |
| `GET /email-finder/decision-maker` | Decision makers d'une entreprise | 10 |

---

## X (Twitter)

### Users

| Endpoint | Description |
|----------|-------------|
| `GET /x/users/info` | Profil utilisateur |
| `GET /x/users/about` | Metadata |
| `GET /x/users/batch` | Profils en batch |
| `GET /x/users/tweets` | Tweets d'un utilisateur |
| `GET /x/users/followers` | Followers |
| `GET /x/users/following` | Following |
| `GET /x/users/mentions` | Mentions |
| `GET /x/users/follow-check` | Verification de follow |
| `GET /x/users/search` | Recherche d'utilisateurs |
| `GET /x/users/verified-followers` | Followers verifies |

### Tweets

| Endpoint | Description |
|----------|-------------|
| `GET /x/tweets/batch` | Tweets en batch |
| `GET /x/tweets/replies` | Reponses a un tweet |
| `GET /x/tweets/quotes` | Citations d'un tweet |
| `GET /x/tweets/retweeters` | Retweeteurs |
| `GET /x/tweets/thread` | Thread complet |
| `GET /x/tweets/article` | Article lie |
| `GET /x/tweets/search` | Recherche de tweets |

### Autres

| Endpoint | Description |
|----------|-------------|
| `GET /x/lists/followers` | Followers d'une liste |
| `GET /x/lists/members` | Membres d'une liste |
| `GET /x/communities/*` | Info, membres, tweets de communautes |
| `GET /x/trends` | Tendances |
| `GET /x/spaces` | Twitter Spaces |

---

## Google

| Endpoint | Description |
|----------|-------------|
| `GET /google/search` | Resultats de recherche Google |
| `GET /google/maps` | Resultats Google Maps |

---

## Autres Sources Disponibles

| Source | Endpoints | Credits |
|--------|-----------|---------|
| **BuiltWith** | Technographics | 1 |
| **GitHub** | Users, Repos, Organizations | 1 |
| **Substack** | Profiles, Posts | 1 |
| **TradingView** | Search, Scanner, Quote, Financials | 1 |
| **YouTube** | Channels, Videos, Shorts, Comments, Transcript, Search | 1 |
| **Shopify** | Store, Products, Collections, Search | 1 |
| **SimilarWeb** | Website Overview | 5 |
| **Majestic SEO** | Site Overview | 5 |
| **Semrush** | Domain Overview | 1 |
| **Indeed** | Jobs, Companies, Reviews, Salaries | 1 |
| **Y Combinator** | Search, Companies | 1 |
| **Product Hunt** | Products, Reviews, Launches | 1 |
| **Reddit** | Subreddit, Comments, User, Search | 1 |
| **TikTok** | Users, Videos, Search, Trending, Music, Shop | 1 |
| **Instagram** | Profiles | 1 |
| **Facebook** | Profiles, Ad Library | 1 |
| **Threads** | Profiles, Search | 1 |
| **Bluesky** | Profiles, Posts, Social | 1 |
| **Trustpilot** | Reviews | 1 |
| **Capterra** | Software | 1 |
| **G2** | Reviews | 1 |
| **Upwork** | Jobs, Freelancers | 1 |
| **Wellfound** | Companies, Jobs, Person | 5 |
| **Airbnb** | Search, Listings | 5 |
| **Booking.com** | Search, Hotels | 5 |
| **TripAdvisor** | Search, Details | 5 |
| **Yelp** | Search, Business, Reviews | 5 |
| **Zillow** | Search, Properties | 5 |
| **Amazon** | Products | 1 |
| **Pinterest** | Search, Pins, Boards | 1 |
| **Twitch** | Profiles, Clips | 1 |
| **Kick** | Clips | 1 |
| **Snapchat** | Profiles | 1 |
| **Fiverr** | Gigs, Sellers, Search | 1 |
| **App Store** | Search, Apps, Developers | 1 |
| **Google Play** | Search, Apps, Developers | 1 |

---

## Codes de reponse HTTP

| Code | Description |
|------|-------------|
| `200` | Succes |
| `400` | Requete invalide / parametres manquants |
| `401` | Cle API invalide ou manquante |
| `402` | Credits insuffisants |
| `404` | Ressource non trouvee |
| `429` | Rate limit depasse |
| `500` | Erreur serveur |
