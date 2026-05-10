# RUG DNA — Onchain Behavioral Intelligence

> AI-driven onchain intelligence platform for the **Build with GoldRush Track** on Superteam Earn.

## What it does

RUG DNA monitors token launches in real time, constructs behavioral graphs of wallets and fund flows, scores projects for rug-pull risk, auto-generates forensic case files when risk exceeds threshold, and evaluates governance trust independently.

**Three intelligence modes:**
- **Risk Monitor** — Live scoring of all tracked projects, sorted by threat level
- **Forensic Mode** — Auto-generated case files with timeline, extraction path, and AI narrative
- **Governance Trust** — Separate decentralization credibility score for DAOs

## Architecture

```
GoldRush Streaming API ──► Event Normalizer ──► In-memory DB
         │                        │
         └──► Historical Backfill  ├──► Risk Engine (heuristic scoring)
                                   ├──► Graph Builder (wallet clustering)
                                   ├──► Forensic Engine (auto case generation)
                                   └──► Governance Engine (trust scoring)
                                                │
                                         Next.js API Routes
                                                │
                                   ┌────────────┴─────────────┐
                               Dashboard              Project Detail
                            (monitor/forensic/gov)   (graph + evidence)
```

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Data:** GoldRush Streaming + Foundational API (`@covalenthq/client-sdk`)
- **AI:** Structured evidence summarization (extensible to Anthropic API)
- **Storage:** In-memory store (swap for PostgreSQL in production)
- **Deploy:** Vercel

## Setup

```bash
git clone https://github.com/yourusername/rug-dna
cd rug-dna
npm install
cp .env.example .env.local
# Add your GOLDRUSH_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## GoldRush Integration

- `GET /api/projects` — seeds mock data, returns all monitored projects
- `POST /api/projects` — ingest real token by address via GoldRush APIs
- `GET /api/stream` — SSE live intelligence feed
- `GET /api/forensic` — forensic case files
- `GET /api/governance` — governance trust scores

## Key Files

```
lib/
  goldrush.ts        # GoldRush API client
  risk-engine.ts     # Heuristic risk scoring
  graph-builder.ts   # Behavioral graph construction  
  forensic-engine.ts # Auto case generation
  governance-engine.ts # Trust scoring
  ingestion.ts       # Data pipeline + mock seeding
  db.ts             # In-memory data store
```

## Demo

1. Visit `/` — see live monitored projects sorted by risk
2. Click a critical project (e.g. $RUGX) → project detail with graph + evidence
3. Click "View Full Case File" → forensic reconstruction with timeline
4. Click Governance tab → decentralization credibility analysis

## License

MIT
