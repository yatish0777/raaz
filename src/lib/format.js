// Formatting helpers + shared visual vocabulary (networks, roles, risk, status)

export const NOW = new Date('2026-09-24T10:00:00+05:30') // dataset "now" - keeps relative times stable
const LOADED = Date.now()
/** Simulated clock: dataset "now" + time since the page loaded (so live alerts tick forward) */
export function nowSim() {
  return new Date(NOW.getTime() + (Date.now() - LOADED))
}

const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function inr(v) {
  if (v == null) return '-'
  return '₹' + inrFmt.format(Math.round(v))
}

/** Indian short form: ₹4.2 L, ₹1.35 Cr */
export function inrShort(v) {
  if (v == null) return '-'
  const a = Math.abs(v)
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  if (a >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`
  return inr(v)
}

export function num(v, d = 0) {
  if (v == null) return '-'
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: d }).format(v)
}

export function token(amount, sym) {
  if (amount == null) return '-'
  const d = ['BTC', 'ETH'].includes(sym) ? 5 : sym === 'BNB' ? 4 : 2
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: d }).format(amount)} ${sym}`
}

export function short(addr, head = 6, tail = 4) {
  if (!addr) return '-'
  return addr.length <= head + tail + 1 ? addr : `${addr.slice(0, head)}…${addr.slice(-tail)}`
}

export function dt(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
}

export function dateOnly(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

export function ago(iso, now = nowSim()) {
  const s = (now - new Date(iso)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  const d = Math.floor(s / 86400)
  return d === 1 ? '1 day ago' : `${d} days ago`
}

export function pct(v, d = 0) {
  return v == null ? '-' : `${(v * 100).toFixed(d)}%`
}

export const NETWORKS = {
  TRON: { name: 'TRON', short: 'TRX', chip: 'bg-red-50 text-red-700 ring-red-200' },
  ETH: { name: 'Ethereum', short: 'ETH', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  BSC: { name: 'BNB Smart Chain', short: 'BSC', chip: 'bg-amber-50 text-amber-800 ring-amber-200' },
  BTC: { name: 'Bitcoin', short: 'BTC', chip: 'bg-orange-50 text-orange-700 ring-orange-200' },
  POLYGON: { name: 'Polygon', short: 'POL', chip: 'bg-violet-50 text-violet-700 ring-violet-200' },
}

/** Detect network family from address format */
export function detectNetwork(addr) {
  const a = (addr || '').trim()
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return { family: 'EVM', networks: ['ETH', 'BSC', 'POLYGON'], label: 'EVM address (Ethereum / BSC / Polygon)' }
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return { family: 'TRON', networks: ['TRON'], label: 'TRON address (Base58, T-prefix)' }
  if (/^(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(a)) return { family: 'BTC', networks: ['BTC'], label: 'Bitcoin address' }
  return null
}

// Graph roles: colour + shape (shape is the secondary encoding so identity is never colour-only)
export const ROLES = {
  victim: { label: 'Victim wallet', color: '#1baf7a', shape: 'circle' },
  inbound: { label: 'Other inbound source', color: '#e87ba4', shape: 'circle' },
  dust: { label: 'Dusting source', color: '#b5b3ab', shape: 'circle' },
  suspect: { label: 'Reported suspect wallet', color: '#e34948', shape: 'circle' },
  intermediary: { label: 'Layering wallet', color: '#7b8699', shape: 'circle' },
  consolidation: { label: 'Consolidation wallet', color: '#eb6834', shape: 'circle' },
  mixer: { label: 'Mixer / tumbler', color: '#4a3aa7', shape: 'diamond' },
  bridge: { label: 'Cross-chain bridge', color: '#eda100', shape: 'triangle' },
  exchange_deposit: { label: 'Exchange deposit address', color: '#2a78d6', shape: 'square' },
  exchange_hot: { label: 'Exchange hot wallet', color: '#0d366b', shape: 'square' },
}

export const RISK = {
  Critical: { cls: 'bg-red-50 text-critical-ink ring-red-200', dot: 'var(--color-critical)' },
  High: { cls: 'bg-orange-50 text-serious-ink ring-orange-200', dot: 'var(--color-serious)' },
  Medium: { cls: 'bg-amber-50 text-warn-ink ring-amber-200', dot: 'var(--color-warn)' },
  Low: { cls: 'bg-green-50 text-good-ink ring-green-200', dot: 'var(--color-good)' },
  Info: { cls: 'bg-slate-50 text-slate-600 ring-slate-200', dot: '#7b8699' },
}

export function riskLevel(score) {
  return score >= 80 ? 'Critical' : score >= 60 ? 'High' : score >= 40 ? 'Medium' : 'Low'
}

export const STATUS = {
  New: 'bg-slate-100 text-slate-700',
  Tracing: 'bg-brand-50 text-brand-700',
  'Exchange Identified': 'bg-indigo-50 text-indigo-700',
  'Notice Sent': 'bg-amber-50 text-warn-ink',
  'KYC Received': 'bg-teal-50 text-teal-700',
  Monitoring: 'bg-violet-50 text-violet-700',
  Closed: 'bg-green-50 text-good-ink',
}
export const STATUS_ORDER = ['New', 'Tracing', 'Exchange Identified', 'Notice Sent', 'KYC Received', 'Monitoring', 'Closed']

export const TX_KIND = {
  victim_payment: 'Victim payment',
  inbound: 'Other inbound',
  dust: 'Dust',
  layering: 'Layering',
  peel: 'Peel-off',
  mixer_in: 'Into mixer',
  mixer_out: 'Mixer output',
  bridge_in: 'Into bridge',
  bridge_out: 'Bridge output',
  consolidation: 'Consolidation',
  exchange_deposit: 'Exchange deposit',
  exchange_sweep: 'Exchange sweep',
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true } catch { return false }
}

export const FRAUD_SHORT = {
  'Investment / Trading App Fraud': 'Trading app fraud',
  'Task-based Part-time Job Fraud': 'Task / job fraud',
  'Pig-butchering (Romance-Investment)': 'Pig-butchering',
  'Fake Crypto Exchange / Wallet': 'Fake exchange',
  'Digital Arrest Scam': 'Digital arrest',
  'Ponzi / MLM Token Scheme': 'Ponzi / MLM',
  'Loan App Extortion': 'Loan app extortion',
}
