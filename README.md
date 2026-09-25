# RAAZ - Automated Anti-Fraud Analysis

**SIH26183** - Real-time identification of fraud-linked cryptocurrency exchanges from victim-reported suspect wallet addresses through automated blockchain analytics.

This is the UI prototype and dummy dataset. The frontend runs fully on generated mock data through a mock API layer that mirrors the planned FastAPI endpoints.

> **Demo data only.** Every wallet address and transaction hash is randomly generated. All exchange, mixer, bridge, person and investigator names are fictional.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

No login: the app opens straight to the dashboard as a demo analyst.

Regenerate the dummy data and the NetworkX graphs (Python 3.9+; the graph step needs `pip install networkx matplotlib scipy`):

```bash
npm run gen-all                                    # both steps below
npm run gen-data                                   # dummy data only (60 cases, seed 26183)
npm run gen-graphs                                 # NetworkX analysis + PNGs only
python scripts/generate_data.py --cases 120 --seed 7
```

## Screens

| # | Route | Screen |
|---|---|---|
| 2 | `/` | Command dashboard: KPIs, case pipeline, NCRP complaint trend, live alerts, charts |
| 3 | `/investigate` | New investigation: wallet input with network auto-detection, complaint details, trace settings |
| 4 | `/analysis/:id` | Analysis progress: simulated Celery pipeline with live log |
| 5 | `/cases/:id` | Investigation workspace: nearest-VASP banner plus 8 tabs (D3 graph, fund flow, transactions, patterns, clusters, exchange attribution, risk score, timeline & legal) |
| 6 | `/wallets/:address` | Wallet profile: labels, risk, cases, counterparties, transactions |
| 7a | `/network` | Network map: NetworkX cross-case graph showing which cases share fraudster wallets (linked groups) |
| 7 | `/exchanges` | VASP directory: FIU-IND status, LEA cooperation, response time, hot wallets |
| 8 | `/reports`, `/reports/:id` | AI report (Ollama) + Section 94 BNSS notice draft, print / PDF |
| 9 | `/cases` | Case list with search, filters, sorting |
| 10 | `/watchlist` | Real-time watchlist & alert feed (a new simulated alert arrives every ~45 s) |

### Suggested 3-minute demo

1. **Dashboard**: 60 cases, ₹ traced to exchanges, the case pipeline, live alerts.
2. **New Investigation**: click a sample wallet chip (or paste any valid TRON / EVM / BTC address) → **Start automated trace**.
3. **Analysis**: the pipeline runs (fetch → trace → graph → patterns → attribution → risk) and then opens the workspace.
4. **Workspace**: the *Nearest probable exchange* banner, the graph with the highlighted path to the exchange, and the Patterns and Risk score tabs.
5. **Generate report** → **Write with Ollama** → switch to the **Notice** tab → Print / Save PDF.
6. Open a case with **Cross-case linkage** (e.g. a *Syndicate A* case) to show several complaints tied to one operator.

## Dummy dataset

Written by `scripts/generate_data.py`:

| File | Rows | What it is |
|---|---|---|
| `public/data/cases.json` | 60 | Case summaries (NCRP ack, victim, fraud type, amount, status, risk, nearest VASP…) |
| `public/data/cases/<id>.json` | 60 | Full case detail: graph nodes, transactions, patterns, clusters, attributions, risk factors, timeline, notice, masked KYC response |
| `public/data/wallets.json` | ~1,250 | Every wallet across all cases with role, label, cluster, risk, totals |
| `public/data/transactions.json` | ~1,600 | Every on-chain transfer (hash, block, time, from, to, amount, token, ₹ value, hop, type) |
| `public/data/exchanges.json` | 12 | Fictional VASPs (Indian, offshore, OTC, P2P) with hot wallets and LEA stats |
| `public/data/alerts.json`, `watchlist.json` | 26 / 20 | Monitoring data |
| `public/data/daily_stats.json` | 90 | National daily complaint / trace volumes |
| `data/csv/*.csv` | - | Same data as CSV for Excel / PPT |

Realism built in: USDT on TRON dominates, as in Indian crypto-fraud complaints. Laundering is modelled as fan-out, peel chains, mixers (probabilistic links), cross-chain bridges, rapid layering, consolidation, dusting and deposit → hot-wallet sweeps. Four "syndicates" reuse consolidation wallets across cases. Exchange attributions carry confidence and a pro-rata victim share.

## NetworkX graph analysis

`scripts/networkx_graph.py` builds one `nx.DiGraph` per case (wallets = nodes, merged transfers = weighted edges) plus a merged graph of all cases, and writes:

| Output | Used by |
|---|---|
| `public/data/nx/<case>.json` | **NetworkX analysis** tab in each case |
| `public/data/nx/global.json` | **Network map** page |
| `public/data/nx/png/*.png` | matplotlib renders for slides (one per case + `global_case_links.png`) |
| `data/csv/nx_case_metrics.csv` | per-case graph metrics table |

| What | NetworkX function |
|---|---|
| Key wallets (routes pass through them) | `betweenness_centrality` |
| Where the money accumulates | `pagerank` (weighted by ₹) |
| Hops to the nearest exchange | `single_source_shortest_path_length` |
| All laundering routes to the exchange | `all_simple_paths` (bottleneck ₹ per route) |
| Most money that can reach exchanges | `maximum_flow` (capacity = ₹ transferred, super-sink over all deposits) |
| Wallet groups | `community.louvain_communities` + `modularity` |
| Layouts | `multipartite_layout` (by hop), `spring_layout`, `kamada_kawai_layout`, `circular_layout` |
| Linked cases / syndicates | `compose_all` + `connected_components` on the case-link graph |

On the demo data it independently finds the 4 syndicates (23 cases) that the generator planted.

## Architecture (target)

```
React + Vite + Tailwind  ──►  FastAPI  ──►  Celery workers (Redis)
   D3 graph, Chart.js           │            ├─ fetch: Etherscan V2 / Blockscout / TRON API / Blockchair
                                │            ├─ trace + graph: NetworkX → Neo4j
                                │            ├─ patterns + clustering, XGBoost risk score
                                │            └─ attribution: address-label DB + hot-wallet sweep matching
                                ├─ PostgreSQL (cases, labels, audit log)
                                └─ Ollama (local LLM) for report narrative
```

`src/lib/api.js` is the mock API. Each function maps to one endpoint, so switching to the real backend only changes that file:

| Mock function | Planned endpoint |
|---|---|
| `listCases()` | `GET /api/cases` |
| `getCase(id)` | `GET /api/cases/{id}` |
| `createInvestigation(form)` | `POST /api/investigations` (enqueues Celery job) |
| `getWallet(address)` | `GET /api/wallets/{address}` |
| `listExchanges()` | `GET /api/vasps` |
| `listAlerts()` / `subscribe()` | `GET /api/alerts` + WebSocket `/ws/alerts` |
| `listWatchlist()` / `addToWatchlist()` | `GET/POST /api/watchlist` |

## AI reports with Ollama

1. Install Ollama from https://ollama.com and pull a model: `ollama pull llama3.1:8b`.
2. It listens on `http://localhost:11434`. RAAZ detects it automatically (see the status in the sidebar).
3. Change the URL or model on the **Reports** page, or through `VITE_OLLAMA_URL` / `VITE_OLLAMA_MODEL` in `.env` (see `.env.example`).
4. If RAAZ is served from another origin (e.g. Vercel), start Ollama with `OLLAMA_ORIGINS=https://<your-app>.vercel.app`.

The model gets only structured case facts and writes the narrative sections. All tables, amounts and addresses in the report come straight from the trace data. Without Ollama, a deterministic template narrative is used.

## Deploy to Vercel

Framework preset **Vite**, build `npm run build`, output `dist`. `vercel.json` already rewrites client-side routes to `index.html`.
