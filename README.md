<div align="center">

<img src="public/favicon.svg" alt="RAAZ logo" width="72" />

# RAAZ - RAPID AUTOMATED ANTI FRAUD ANALYSIS

**Follow the stolen crypto from a victim's complaint to the exchange that is holding it.**

Smart India Hackathon 2026 · Problem Statement **SIH26183**
*Real-Time Identification of Fraud-Linked Cryptocurrency Exchanges from Victim-Reported Suspect Wallet Addresses through Automated Blockchain Analytics*

[![Live demo](https://img.shields.io/badge/Live_demo-raaz--kappa.vercel.app-1d4ed8?style=for-the-badge)](https://raaz-kappa.vercel.app)

![React](https://img.shields.io/badge/React_19-0b1f3a?logo=react&logoColor=61dafb)
![Vite](https://img.shields.io/badge/Vite-0b1f3a?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-0b1f3a?logo=tailwindcss&logoColor=38bdf8)
![D3](https://img.shields.io/badge/D3.js-0b1f3a?logo=d3dotjs&logoColor=f9a03c)
![NetworkX](https://img.shields.io/badge/NetworkX-0b1f3a?logo=python&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-0b1f3a?logo=ollama&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-0b1f3a?logo=vercel&logoColor=white)

[Problem](#the-problem) · [Solution](#our-solution) · [Screenshots](#screenshots) · [How it works](#how-it-works) · [NetworkX](#networkx-graph-analysis) · [Prototype status](#prototype-status-what-is-real-and-what-is-simulated) · [Run it](#run-it-locally) · [Architecture](#target-architecture)

<br />

<img src="docs/screenshots/04-investigation-workspace.png" alt="RAAZ investigation workspace showing the nearest probable exchange and the fund-flow graph" width="100%" />

</div>

> **Demo data only.** Every wallet address and transaction hash in this repository is randomly generated. All exchange, mixer, bridge, victim and officer names are fictional. Nothing here refers to a real person, wallet or company.

---

## The problem

Crypto is now a favourite cash-out route for online fraud: fake trading apps, task-based job scams, pig-butchering, digital-arrest calls. A victim files a complaint with a **wallet address** and a payment screenshot. That is all the police start with.

To recover the money, investigators must find **which exchange (VASP) received it**, because only the exchange holds the KYC details and can freeze the funds. Today this means tracing the money by hand across many wallets, bridges and mixers, on several blockchains, while the fraudsters move it again within hours. By the time the exchange is identified, the funds are often gone.

## Our solution

RAAZ is a web platform for cybercrime investigators. **Enter the victim-reported wallet and the blockchain network. RAAZ does the tracing.**

| The investigator gets | How |
|---|---|
| Every wallet the money touched, hop by hop | Automated multi-hop trace on BTC, Ethereum, TRON, BSC and Polygon |
| A transaction graph they can explore | Interactive D3 graph with the route to the exchange highlighted |
| The laundering pattern named | Fan-out, peel chains, mixers, cross-chain bridges, rapid layering, consolidation, dusting |
| **The nearest probable exchange**, with proof | Deposit address swept into a known exchange hot wallet, with a confidence score and the complainant's pro-rata share |
| A risk score with reasons | 0-100 score and a ranked list of the factors behind it |
| Links to other cases | Wallets shared between complaints reveal the same operator |
| Documents ready to send | Investigation report (AI-written narrative) and a draft Section 94 BNSS notice to the exchange asking for KYC and a freeze |
| Live alerts | Watchlisted wallets raise an alert the moment funds move |

The nearest exchange is the single most useful fact in a case. RAAZ puts it at the top of the page.

---

## Screenshots

<table>
  <tr>
    <td width="50%"><a href="docs/screenshots/01-dashboard.png"><img src="docs/screenshots/01-dashboard.png" alt="Command dashboard" /></a><br /><sub><b>1. Command dashboard.</b> Case pipeline, amounts traced to exchanges, live alerts, trends.</sub></td>
    <td width="50%"><a href="docs/screenshots/02-new-investigation.png"><img src="docs/screenshots/02-new-investigation.png" alt="New investigation form" /></a><br /><sub><b>2. New investigation.</b> Paste a wallet; the blockchain network is detected from its format.</sub></td>
  </tr>
  <tr>
    <td><a href="docs/screenshots/03-analysis-progress.png"><img src="docs/screenshots/03-analysis-progress.png" alt="Analysis in progress" /></a><br /><sub><b>3. Automated analysis.</b> The pipeline runs stage by stage with a live log.</sub></td>
    <td><a href="docs/screenshots/05-transaction-graph.png"><img src="docs/screenshots/05-transaction-graph.png" alt="Transaction graph" /></a><br /><sub><b>4. Transaction graph.</b> Hops run left to right. The blue path leads to the exchange; the diamond is a mixer.</sub></td>
  </tr>
  <tr>
    <td><a href="docs/screenshots/06-networkx-analysis.png"><img src="docs/screenshots/06-networkx-analysis.png" alt="NetworkX analysis tab" /></a><br /><sub><b>5. NetworkX analysis.</b> Centrality, all routes to the exchange, max flow, communities, three layouts.</sub></td>
    <td><a href="docs/screenshots/07-suspicious-patterns.png"><img src="docs/screenshots/07-suspicious-patterns.png" alt="Suspicious patterns" /></a><br /><sub><b>6. Suspicious patterns.</b> Each pattern comes with a description, confidence and the wallets that prove it.</sub></td>
  </tr>
  <tr>
    <td><a href="docs/screenshots/08-exchange-attribution.png"><img src="docs/screenshots/08-exchange-attribution.png" alt="Exchange attribution" /></a><br /><sub><b>7. Exchange attribution.</b> Which exchange, how far, how much, and which deposit address to ask about.</sub></td>
    <td><a href="docs/screenshots/09-risk-score.png"><img src="docs/screenshots/09-risk-score.png" alt="Risk score" /></a><br /><sub><b>8. Risk score.</b> A 0-100 gauge and what pushed it up.</sub></td>
  </tr>
  <tr>
    <td><a href="docs/screenshots/10-network-map.png"><img src="docs/screenshots/10-network-map.png" alt="Network map" /></a><br /><sub><b>9. Network map.</b> NetworkX links complaints that share a fraudster-controlled wallet: 4 operator groups across 23 cases.</sub></td>
    <td><a href="docs/screenshots/11-investigation-report.png"><img src="docs/screenshots/11-investigation-report.png" alt="Investigation report" /></a><br /><sub><b>10. Investigation report.</b> Narrative written by a local Ollama model; every table comes straight from the trace.</sub></td>
  </tr>
  <tr>
    <td><a href="docs/screenshots/12-notice-to-exchange.png"><img src="docs/screenshots/12-notice-to-exchange.png" alt="Notice to exchange" /></a><br /><sub><b>11. Notice to the exchange.</b> Draft Section 94 BNSS notice with the deposit address, transaction hashes and freeze request.</sub></td>
    <td><a href="docs/screenshots/13-vasp-directory.png"><img src="docs/screenshots/13-vasp-directory.png" alt="VASP directory" /></a><br /><sub><b>12. VASP directory.</b> FIU-IND status, cooperation with police, response time, known hot wallets.</sub></td>
  </tr>
  <tr>
    <td><a href="docs/screenshots/14-watchlist-alerts.png"><img src="docs/screenshots/14-watchlist-alerts.png" alt="Watchlist and alerts" /></a><br /><sub><b>13. Watchlist and alerts.</b> Real-time feed for wallets under monitoring.</sub></td>
    <td><a href="docs/screenshots/15-wallet-profile.png"><img src="docs/screenshots/15-wallet-profile.png" alt="Wallet profile" /></a><br /><sub><b>14. Wallet profile.</b> One wallet used in five complaints: a cash-out hub for the same operator.</sub></td>
  </tr>
  <tr>
    <td><a href="docs/screenshots/16-cases.png"><img src="docs/screenshots/16-cases.png" alt="Cases list" /></a><br /><sub><b>15. Cases.</b> Search, filter and sort all investigations.</sub></td>
    <td align="center"><a href="docs/screenshots/17-mobile.png"><img src="docs/screenshots/17-mobile.png" alt="Mobile layout" width="55%" /></a><br /><sub><b>16. Responsive.</b> Works on a phone for field officers.</sub></td>
  </tr>
</table>

---

## How it works

```mermaid
flowchart LR
    A["Victim complaint<br/>(NCRP + wallet address)"] --> B["Investigator enters<br/>wallet + network"]
    B --> C["1. Fetch transactions<br/>chain explorers"]
    C --> D["2. Trace multi-hop<br/>fund flow"]
    D --> E["3. Build transaction graph<br/>(NetworkX)"]
    E --> F["4. Detect patterns<br/>and cluster wallets"]
    E --> G["5. Attribute exchange<br/>(deposit → hot wallet)"]
    F --> H["6. Risk score"]
    G --> H
    H --> I["Report + Sec. 94 BNSS<br/>notice to exchange"]
    G --> J["Watchlist alerts"]
```

**How the exchange is identified.** Exchanges give each customer a unique *deposit address*, then sweep those deposits into a few *hot wallets*. When RAAZ sees the fraudster's money arrive at an address that is later swept into a known exchange hot wallet, it attributes that address to the exchange. Confidence drops when the path passes through a mixer (the link is only probabilistic) or when the exchange is many hops away. The attribution also gives the **complainant's pro-rata share** of what reached the exchange, which is the amount to ask the exchange to freeze.

**What the investigator does next.** The exchange holds the KYC. RAAZ drafts the notice: exchange, deposit address, transaction hashes, freeze amount, legal basis. The investigating officer checks, signs and sends it.

---

## NetworkX graph analysis

The graph analysis is real code, not mock-up. [`scripts/networkx_graph.py`](scripts/networkx_graph.py) builds a NetworkX `DiGraph` for every case (wallets are nodes, merged transfers are ₹-weighted edges) and a merged graph of all cases, then writes the results the app displays.

| Question | NetworkX function |
|---|---|
| Which wallets do most routes pass through? | `betweenness_centrality` |
| Where does the money pool? | `pagerank` (weighted by ₹) |
| How many hops to the nearest exchange? | `single_source_shortest_path_length` |
| Every route from the reported wallet to the exchange | `all_simple_paths`, with the smallest transfer on each route |
| The most money that can possibly reach exchanges | `maximum_flow` (capacity = ₹ transferred) |
| Which wallets belong together? | `community.louvain_communities`, `modularity` |
| Which complaints belong to the same operator? | `compose_all` + `connected_components` on a case-to-case graph |
| Layouts | `multipartite_layout` (by hop), `spring_layout`, `kamada_kawai_layout`, `circular_layout` |

On the demo data, NetworkX independently finds the **four operator groups (23 cases)** that the data generator planted, and its shortest-path hop counts match the exchange attribution in every case that reaches an exchange. The JSON output is deterministic: rerunning gives identical files.

Ready-made images for slides: [`public/data/nx/png/`](public/data/nx/png) has one matplotlib render per case plus [`global_case_links.png`](public/data/nx/png/global_case_links.png).

---

## Prototype status: what is real and what is simulated

This repository is the **UI prototype and dataset** for the hackathon. We are clear about what runs today.

| Area | Status | Details |
|---|---|---|
| Web app (10+ screens) | ✅ Built | React + Vite + Tailwind, D3 graph, Chart.js, responsive, deployed on Vercel |
| Dummy dataset | ✅ Built | 60 cases, 1,246 wallets, 1,593 transactions, 12 fictional exchanges; deterministic generator with CSV exports |
| NetworkX analysis | ✅ Built | Computed from the transaction graph (see above) |
| AI report writing | ✅ Client built | Streams from a local Ollama model, falls back to an offline template. Tested against a stand-in for the Ollama API; needs a real model on your machine (see [Ollama](#ai-reports-with-ollama)) |
| Reports, notices, evidence hash | ✅ Built | Print / save as PDF; SHA-256 of the evidence bundle |
| Pattern labels, clusters, attribution confidence, risk score | 🧪 Modelled | Produced together with the dummy data to show the intended output; not yet computed by a rule engine or trained model |
| Live blockchain data | 🔜 Planned | The app reads JSON through a mock API layer ([`src/lib/api.js`](src/lib/api.js)) shaped like the future FastAPI responses |
| FastAPI, Celery + Redis, PostgreSQL, Neo4j | 🔜 Planned | See [target architecture](#target-architecture) |
| XGBoost risk model, real address-label database | 🔜 Planned | Needs labelled historical cases |
| Login / SSO | ⏸ Left out | The prototype opens straight to the dashboard. Production would use department SSO with hardware OTP and audit logging |

"New investigation" works on any valid TRON, EVM or Bitcoin address. For a wallet that is not in the dataset, the app builds a result from an existing case on the same network and marks it **"Demo-generated result"**.

---

## Tech stack

| Layer | In this prototype | Target production |
|---|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router | same |
| Visualisation | D3.js (graph), Chart.js | same |
| Graph analysis | **NetworkX** (offline, on the dummy data) | NetworkX in workers + **Neo4j** for storage and queries |
| Backend | Mock API layer over JSON files | **FastAPI** |
| Blockchain data | Generated | Etherscan V2, Blockscout, TRON API, Blockchair / Bitcoin APIs, Web3.py |
| Background jobs | Simulated pipeline animation | **Celery + Redis** |
| Database | JSON / CSV files | **PostgreSQL** |
| Machine learning | Modelled scores | scikit-learn / **XGBoost** |
| AI reporting | **Ollama** (local LLM; case data never leaves the machine) | Ollama on a department GPU server, called by the backend |
| Hosting | Vercel | Vercel (frontend) + department-hosted backend |

## Target architecture

```mermaid
flowchart TB
    subgraph Browser
        UI["React + Vite + Tailwind<br/>D3 graph · Chart.js"]
    end
    subgraph Backend["Backend (planned)"]
        API["FastAPI"]
        W["Celery workers"]
        R[("Redis")]
        PG[("PostgreSQL<br/>cases · labels · audit log")]
        N[("Neo4j<br/>transaction graph")]
        ML["XGBoost risk model"]
    end
    subgraph External
        CH["Etherscan V2 · Blockscout<br/>TRON API · Blockchair"]
        LLM["Ollama (local LLM)"]
    end
    UI <-->|"REST + WebSocket alerts"| API
    API --> R --> W
    W -->|"fetch transactions"| CH
    W -->|"NetworkX trace + graph"| N
    W --> ML
    W --> PG
    API --> PG
    API -->|"report narrative"| LLM
```

`src/lib/api.js` is the seam. Each function there maps to one endpoint, so moving to the real backend means changing that one file.

| Mock function | Planned endpoint |
|---|---|
| `listCases()` / `getCase(id)` | `GET /api/cases` · `GET /api/cases/{id}` |
| `createInvestigation(form)` | `POST /api/investigations` (enqueues the Celery pipeline) |
| `getNx(id)` / `getNxGlobal()` | `GET /api/cases/{id}/graph` · `GET /api/graph/global` |
| `getWallet(address)` | `GET /api/wallets/{address}` |
| `listExchanges()` | `GET /api/vasps` |
| `listAlerts()` / `subscribe()` | `GET /api/alerts` + WebSocket `/ws/alerts` |
| `listWatchlist()` / `addToWatchlist()` | `GET /api/watchlist` · `POST /api/watchlist` |

---

## The dummy dataset

Generated by [`scripts/generate_data.py`](scripts/generate_data.py). The same seed always gives the same data.

| Data | Size | Notes |
|---|---|---|
| Cases | 60 | NCRP-style IDs, complainants across 10 states, ₹14.9 Cr lost in total. 29 TRON, 11 BSC, 9 Ethereum, 6 Bitcoin, 5 Polygon |
| Wallets | 1,246 | Addresses in the right format for each chain (`T…`, `0x…`, `bc1…`) but random |
| Transactions | 1,593 | Hash, block, time, from, to, amount, token, ₹ value, hop number, type |
| Exchanges | 12 | Fictional: Indian, offshore, OTC and P2P, with hot wallets and how well they respond to police |
| Fraud types | 7 | Trading-app fraud, task-based job fraud, pig-butchering, fake exchange, digital arrest, Ponzi / MLM, loan-app extortion |
| Alerts, watchlist, daily stats | 26 · 20 · 90 days | Feed the dashboard and monitoring screens |

**Realism built in:** USDT on TRON dominates, as in Indian crypto-fraud complaints. Laundering runs through fan-out, peel chains, mixers, cross-chain bridges, rapid layering, consolidation, dusting and exchange deposit-to-hot-wallet sweeps. Four "syndicates" reuse one collecting wallet across several complaints. Amounts are in ₹ with Indian number formatting. Victim personal data is masked, as it would be in production.

Files: JSON in [`public/data/`](public/data) (used by the app) and CSV in [`data/csv/`](data/csv) (for Excel and slides).

---

## Run it locally

You need **Node.js 18+**. Python 3.9+ is only needed if you regenerate the data.

```bash
git clone https://github.com/yatish0777/raaz.git
cd raaz
npm install
npm run dev        # then open http://localhost:5173
```

No login is needed.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run gen-data` | Regenerate the dummy dataset (`--cases 120 --seed 7` for a bigger set) |
| `npm run gen-graphs` | Recompute the NetworkX analysis and PNGs (`pip install networkx matplotlib scipy`) |
| `npm run gen-all` | Both of the above |
| `npm run screenshots` | Retake every screenshot in this README (needs Chrome or Edge, run `npm run build` first) |

### AI reports with Ollama

1. Install Ollama from [ollama.com](https://ollama.com), then run `ollama pull llama3.1:8b`.
2. Ollama listens on `http://localhost:11434`. RAAZ detects it automatically (see the status in the sidebar).
3. Open **Reports** to change the URL or model, or set `VITE_OLLAMA_URL` and `VITE_OLLAMA_MODEL` in `.env` (see [`.env.example`](.env.example)).
4. If RAAZ is served from another site (for example Vercel), start Ollama with `OLLAMA_ORIGINS=https://your-site.vercel.app`.

The model only receives the structured facts of one case and writes the narrative. Tables, amounts and addresses in the report come from the trace data, never from the model. Without Ollama, a template narrative is used, so the report always works.

### Deploy to Vercel

Import the repository in Vercel. Framework preset **Vite**, build command `npm run build`, output `dist`. [`vercel.json`](vercel.json) already rewrites client-side routes to `index.html`.

---

## Suggested 3-minute demo

1. **Dashboard.** 60 cases, ₹34.5 Cr traced to exchanges, where every case stands, live alerts.
2. **New investigation.** Click a sample wallet chip, then **Start automated trace**.
3. **Analysis.** Watch the six-stage pipeline run, then the workspace opens.
4. **Workspace.** Read the *nearest probable exchange* banner, follow the blue path in the graph to the exchange, then open **Patterns** and **Risk score**.
5. **NetworkX analysis** tab. Switch layouts, size nodes by betweenness, colour by community, read the routes to the exchange.
6. **Generate report**, then **Write with Ollama**, then the **Notice** tab.
7. **Network map.** Four operator groups found across 23 complaints. Open case `RAAZ-26-1027` to see one of them.

---

## Project structure

```
raaz/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx, NewInvestigation.jsx, Analysis.jsx, Cases.jsx
│   │   ├── Workspace.jsx          case workspace (banner, graph, tabs)
│   │   ├── NetworkMap.jsx         NetworkX cross-case map
│   │   ├── WalletProfile.jsx, Exchanges.jsx, Watchlist.jsx
│   │   ├── Reports.jsx, ReportView.jsx
│   │   └── workspace/
│   │       ├── tabs.jsx           fund flow, transactions, patterns, clusters, attribution, risk, timeline
│   │       └── NxTab.jsx          NetworkX analysis tab
│   ├── components/                TxGraph (D3), NxGraphView, RiskGauge, charts, ui, Layout
│   └── lib/                       api.js (mock API), ollama.js, report.js, format.js
├── scripts/
│   ├── generate_data.py           deterministic dummy-data generator
│   ├── networkx_graph.py          NetworkX analysis + matplotlib PNGs
│   └── screenshots.mjs            retakes the README screenshots
├── public/data/                   JSON used by the app (nx/ holds NetworkX results and PNGs)
├── data/csv/                      the same data as CSV
├── docs/screenshots/              images used in this README
└── vercel.json
```

## Responsible use

RAAZ is designed for authorised law-enforcement use.

- **Human in the loop.** Scores and attributions are leads, not proof. Confidence is always shown, and the notice is a draft that the investigating officer checks, signs and sends.
- **Privacy.** KYC responses show masked personal data. Full details are for the assigned officer only.
- **Evidence integrity.** Each report includes a SHA-256 hash of the transaction bundle, supporting the electronic-records certificate under Section 63 of the Bharatiya Sakshya Adhiniyam, 2023.
- **Probabilistic links are marked.** Mixer outputs are shown as dashed lines and reduce confidence.

## Roadmap

- [ ] FastAPI backend with the endpoints above, and live chain data from Etherscan V2, Blockscout, TRON API and Blockchair
- [ ] Celery + Redis pipeline for tracing, with progress streamed to the UI
- [ ] Neo4j graph store and PostgreSQL case database
- [ ] Address-label database and exchange deposit-address heuristics, validated on real labelled data
- [ ] XGBoost risk model trained on historical cases
- [ ] Department SSO, role-based access and audit log
- [ ] Hindi and regional-language support
- [ ] Direct integration with NCRP and I4C systems

## Built by

Yatish Patki ([@yatish0777](https://github.com/yatish0777)) for Smart India Hackathon 2026, problem statement SIH26183.

<!-- Add teammates and team name here -->
