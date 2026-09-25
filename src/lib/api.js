// Mock API layer.
// Every function here mirrors a FastAPI endpoint the real backend will expose.
// Today they read the generated JSON in /public/data; later swap `get()` for real fetch calls
// e.g. GET /api/cases  ->  listCases(),  POST /api/investigations  ->  createInvestigation()

import { detectNetwork, nowSim } from './format'

const BASE = '/data'
const cache = new Map()
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function get(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(`${BASE}/${path}`).then((r) => {
        if (!r.ok) throw new Error(`${r.status} loading ${path}`)
        return r.json()
      }),
    )
  }
  return cache.get(path)
}

// ---- session state (investigations created in this browser session) --------
function loadSS(key, fallback) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback } catch { return fallback }
}
function saveSS(key, val) {
  try { sessionStorage.setItem(key, JSON.stringify(val)) } catch { /* storage unavailable - keep in memory only */ }
}
const created = loadSS('raaz.created', {})
const watchAdds = loadSS('raaz.watchAdds', [])

// ---- reference data ----------------------------------------------------------
export const getMeta = () => get('meta.json')
export const listInvestigators = () => get('investigators.json')
export const getDailyStats = () => get('daily_stats.json')
export const getSamples = () => get('samples.json')
export const listExchanges = () => get('exchanges.json')

// ---- cases -------------------------------------------------------------------
export async function listCases() {
  const base = await get('cases.json')
  return [...Object.values(created).map((d) => d.case).reverse(), ...base]
}

export async function getCase(id) {
  if (created[id]) return created[id]
  return get(`cases/${id}.json`)
}

// ---- NetworkX analysis (GET /api/cases/{id}/graph, GET /api/graph/global) ----
export async function getNx(id) {
  const d = created[id]
  if (!d) return get(`nx/${id}.json`)
  // demo-generated case: reuse the template's NetworkX result with the new wallet + amounts
  const [base, tpl] = await Promise.all([get(`nx/${d.template_of}.json`), get(`cases/${d.template_of}.json`)])
  const nx = structuredClone(base)
  const old = tpl.case.reported_wallet
  const sub = (a) => (a === old ? d.case.reported_wallet : a)
  const k = d.case.amount_lost_inr / tpl.case.amount_lost_inr
  nx.case_id = id
  nx.demo_generated = true
  nx.nodes.forEach((n) => Object.assign(n, { id: sub(n.id), in_inr: Math.round(n.in_inr * k), out_inr: Math.round(n.out_inr * k) }))
  nx.edges.forEach((e) => Object.assign(e, { source: sub(e.source), target: sub(e.target), value_inr: Math.round(e.value_inr * k), flow_inr: Math.round(e.flow_inr * k) }))
  nx.key_wallets = nx.key_wallets.map(sub)
  nx.paths.forEach((p) => Object.assign(p, { path: p.path.map(sub), bottleneck_inr: Math.round(p.bottleneck_inr * k) }))
  nx.communities = nx.communities.map((c) => c.map(sub))
  nx.stats.max_flow_to_exchanges_inr = Math.round(nx.stats.max_flow_to_exchanges_inr * k)
  return nx
}
export const getNxGlobal = () => get('nx/global.json')

// ---- wallets -----------------------------------------------------------------
export async function getWallet(address) {
  const [wallets, txs] = await Promise.all([get('wallets.json'), get('transactions.json')])
  const a = address.toLowerCase()
  let w = wallets.find((x) => x.address.toLowerCase() === a)
  let rows = txs.filter((t) => t.from_address.toLowerCase() === a || t.to_address.toLowerCase() === a)
  for (const d of Object.values(created)) {
    const n = d.nodes.find((x) => x.address.toLowerCase() === a)
    if (!n) continue
    const mine = d.transactions.filter((t) => t.from_address.toLowerCase() === a || t.to_address.toLowerCase() === a)
    rows = [...mine, ...rows]
    if (!w) {
      w = { address: n.address, network: n.network, role: n.role, label: n.label, entity: n.entity, cluster_id: n.cluster_id,
        cases: [d.case.id], in_inr: n.in_inr, out_inr: n.out_inr, tx_count: n.tx_count, first_seen: n.first_seen,
        last_seen: n.last_seen, balance: n.balance, token: d.case.token, risk_score: d.case.risk_score }
    } else if (!w.cases.includes(d.case.id)) {
      w = { ...w, cases: [d.case.id, ...w.cases] }
    }
  }
  if (!w) return null
  rows = [...new Map(rows.map((t) => [t.id + t.case_id, t])).values()].sort((x, y) => y.timestamp.localeCompare(x.timestamp))
  return { wallet: w, transactions: rows }
}

// ---- alerts & watchlist ------------------------------------------------------
const readIds = new Set()
let liveAlerts = []
const subs = new Set()
const notify = () => subs.forEach((fn) => fn())

export function subscribe(fn) {
  subs.add(fn)
  return () => subs.delete(fn)
}

export async function listAlerts() {
  const base = await get('alerts.json')
  return [...liveAlerts, ...base].map((a) => ({ ...a, read: a.read || readIds.has(a.id) }))
}

export function markAlertRead(id) {
  readIds.add(id)
  notify()
}

export async function markAllRead() {
  ;(await listAlerts()).forEach((a) => readIds.add(a.id))
  notify()
}

export async function listWatchlist() {
  const base = await get('watchlist.json')
  return [...watchAdds, ...base]
}

export async function addToWatchlist(entry) {
  const list = await listWatchlist()
  if (list.some((w) => w.address === entry.address)) return false
  watchAdds.unshift({ status: 'Active', added_on: nowSim().toISOString(), added_by: 'Ananya Sharma', ...entry })
  saveSS('raaz.watchAdds', watchAdds)
  notify()
  return true
}

const LIVE_TEMPLATES = [
  ['OUTBOUND_TRANSFER', 'High', (w) => `Watched wallet moved ${fakeAmt(w.token)} ${w.token} to a new address`],
  ['NEW_INBOUND', 'High', (w) => `New inbound of ${fakeAmt(w.token)} ${w.token} to watched wallet - possible new victim`],
  ['EXCHANGE_DEPOSIT', 'Critical', () => `Funds from watched wallet reached an exchange deposit address in 2 hops`],
]
function fakeAmt(tok) {
  const v = ['BTC', 'ETH', 'BNB'].includes(tok) ? (Math.random() * 2 + 0.05).toFixed(3) : Math.round(Math.random() * 18000 + 400)
  return Number(v).toLocaleString('en-IN')
}
let feedStarted = false
/** Simulates the Celery/websocket push of real-time watchlist alerts */
export function startLiveFeed() {
  if (feedStarted) return
  feedStarted = true
  let n = 0
  const tick = async () => {
    const wl = await listWatchlist()
    const w = wl[Math.floor(Math.random() * wl.length)]
    const [type, severity, msg] = LIVE_TEMPLATES[n % LIVE_TEMPLATES.length]
    liveAlerts = [{ id: `ALT-LIVE-${++n}`, type, severity, case_id: w.case_id, address: w.address, network: w.network,
      message: msg(w), tx_hash: null, at: nowSim().toISOString(), read: false, live: true }, ...liveAlerts]
    notify()
  }
  setTimeout(tick, 15000)
  setInterval(tick, 45000)
}

// ---- new investigation -------------------------------------------------------
function hashStr(s) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

/**
 * POST /api/investigations
 * Real backend: enqueue Celery job -> fetch txs -> trace -> graph -> cluster -> attribute -> score.
 * Demo: if the wallet is already known, open that case; otherwise synthesise a result from a
 * template case on the same network (clearly marked as demo-generated).
 */
export async function createInvestigation(f) {
  await wait(300)
  const cases = await listCases()
  const addr = f.address.trim()
  const existing = cases.find((c) => c.reported_wallet.toLowerCase() === addr.toLowerCase())
  if (existing) return { id: existing.id, existing: true }

  const pool = cases.filter((c) => c.network === f.network && c.nearest_exchange && !c.id.startsWith('RAAZ-26-2'))
  const tpl = pool[hashStr(addr) % pool.length] ?? cases.find((c) => c.nearest_exchange)
  const d = structuredClone(await getCase(tpl.id))
  const old = d.case.reported_wallet
  const id = `RAAZ-26-${2001 + Object.keys(created).length}`
  const amount = Number(f.amount) || d.case.amount_lost_inr
  const k = amount / d.case.amount_lost_inr
  const sub = (a) => (a === old ? addr : a)
  const r = (v, tok) => (v == null ? v : Number((v * k).toFixed(['BTC', 'ETH'].includes(tok) ? 5 : 2)))

  // shift timeline so the first victim payment lands on the incident date
  const firstPay = d.transactions.find((t) => t.kind === 'victim_payment')
  const incident = f.incidentDate ? new Date(`${f.incidentDate}T11:00:00+05:30`) : new Date(firstPay.timestamp)
  let shift = incident - new Date(firstPay.timestamp)
  const last = Math.max(...d.transactions.map((t) => +new Date(t.timestamp))) + shift
  const now = +nowSim()
  if (last > now - 30 * 60000) shift -= last - (now - 30 * 60000)
  const mv = (iso) => (iso ? new Date(+new Date(iso) + shift).toISOString() : iso)

  d.nodes.forEach((n) => {
    n.address = sub(n.address)
    Object.assign(n, { in_amount: r(n.in_amount, d.case.token), out_amount: r(n.out_amount, d.case.token), balance: r(n.balance, d.case.token),
      in_inr: Math.round(n.in_inr * k), out_inr: Math.round(n.out_inr * k), first_seen: mv(n.first_seen), last_seen: mv(n.last_seen) })
  })
  d.transactions.forEach((t) => {
    Object.assign(t, { from_address: sub(t.from_address), to_address: sub(t.to_address), case_id: id,
      amount: r(t.amount, t.token), value_inr: Math.round(t.value_inr * k), timestamp: mv(t.timestamp) })
  })
  d.patterns.forEach((p) => (p.wallets = p.wallets.map(sub)))
  d.clusters.forEach((c) => (c.wallets = c.wallets.map(sub)))
  d.attributions.forEach((a) => {
    a.amount_inr = Math.round(a.amount_inr * k)
    a.victim_attributable_inr = Math.round(a.victim_attributable_inr * k)
  })
  d.pool_inr = Math.round(d.pool_inr * k)
  const nowIso = new Date(now).toISOString()
  const n0 = d.attributions[0]
  d.case = {
    ...d.case, id, ncrp_ack: f.ncrp || 'Not provided', fraud_type: f.fraudType, title: `${f.fraudType} - ${f.district || f.state}`,
    description: f.notes || d.case.description, victim: { name: f.victimName || 'Not provided', age: null, phone: '-' },
    state: f.state, district: f.district || '-', reported_at: incident.toISOString(), created_at: nowIso, network: f.network,
    reported_wallet: addr, amount_lost_inr: amount, amount_lost_token: r(d.case.amount_lost_token, d.case.token),
    status: 'Exchange Identified', investigator_id: 'INV01', investigator: 'Ananya Sharma',
    traced_to_vasp_inr: Math.round(d.case.traced_to_vasp_inr * k), held_in_wallets_inr: Math.round(d.case.held_in_wallets_inr * k),
    frozen_inr: 0, demo_generated: true, trace_depth: f.depth,
  }
  d.timeline = [
    { at: incident.toISOString(), event: 'First payment by complainant to suspect wallet' },
    { at: nowIso, event: `Case opened in RAAZ by Ananya Sharma${f.ncrp ? ` (NCRP ${f.ncrp})` : ''}` },
    { at: nowIso, event: `Automated multi-hop trace completed (depth ${f.depth})` },
    ...(n0 ? [{ at: nowIso, event: `Nearest VASP identified: ${n0.exchange} (${n0.hops} hops, ${Math.round(n0.confidence * 100)}% confidence)` }] : []),
  ]
  d.notice = null
  d.kyc_response = null
  d.template_of = tpl.id
  created[id] = d
  saveSS('raaz.created', created)
  if (f.watch) await addToWatchlist({ address: addr, network: f.network, case_id: id, label: 'Reported suspect wallet',
    reason: `Suspect wallet in ${f.fraudType}`, risk_score: d.case.risk_score, balance: null, token: d.case.token })
  return { id, existing: false }
}

// ---- global search -----------------------------------------------------------
export async function search(q) {
  const s = q.trim()
  if (!s) return null
  const cases = await listCases()
  const lc = s.toLowerCase()
  const c = cases.find((x) => x.id.toLowerCase() === lc || x.ncrp_ack === s || x.reported_wallet.toLowerCase() === lc)
  if (c) return `/cases/${c.id}`
  const w = await getWallet(s)
  if (w) return `/wallets/${w.wallet.address}`
  const partial = cases.find((x) => x.id.toLowerCase().includes(lc) || x.victim.name.toLowerCase().includes(lc))
  if (partial) return `/cases/${partial.id}`
  if (detectNetwork(s)) return `/investigate?address=${encodeURIComponent(s)}`
  return `/cases?q=${encodeURIComponent(s)}`
}
