# SalesOS

SalesOS is a **sales intelligence application** built for Coachello, designed to give sales teams a unified workspace to prospect smarter, track deals, and leverage AI to close more.

## What it does

- **Unified Search** — search across HubSpot, Slack, Gmail and meeting notes from a single interface
- **AI Prospecting Writer** — generate personalized outreach emails powered by Claude
- **Deal Intelligence** — get full context on a deal (interactions, notes, signals) in one view
- **Meeting Prep Briefing** — auto-generated briefings before each call
- **Competitive Watch** — real-time monitoring of competitor activity
- **Relationship Health Score** — detect deals going cold before it's too late

## Tech Stack

- **Frontend**: Next.js 14 + Tailwind CSS + shadcn/ui — deployed on Vercel
- **Backend**: Node.js (Hono) — deployed on Railway
- **Database**: PostgreSQL via Supabase + pgvector for semantic search
- **AI**: Claude (Anthropic) for generation & analysis, OpenAI embeddings for search
- **Auth**: Clerk (OAuth 2.0)
- **Connectors**: HubSpot, Slack, Gmail, Outlook, Granola, LinkedIn (ProxyCurl)

## Architecture

3-tier architecture: Next.js frontend → Node.js API → Data/AI layer (PostgreSQL, vector DB, Claude API, external connectors).

See [SalesOS_TechPitch.md](./SalesOS_TechPitch.md) for the full technical documentation.

## Estimated Cost

~$130–$350/month for a 1–5 user MVP (infra + AI + connectors).

---

*Coachello · Internal project · March 2026*
