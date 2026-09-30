import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CircleAlert, CircleCheck, Copy, Info, LoaderCircle, OctagonAlert, TriangleAlert } from 'lucide-react'
import { NETWORKS, RISK, STATUS, copyText, short } from '../lib/format'

export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    fn()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

export const btn = {
  primary: 'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 disabled:cursor-not-allowed',
  secondary: 'inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50',
  ghost: 'inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-ink-2 hover:bg-slate-100 hover:text-ink',
  navy: 'inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800',
}

const inputBase =
  'rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none'
export const input = `w-full ${inputBase}`
/** compact control for filter rows (sizes to content) */
export const inputAuto = `w-auto ${inputBase}`

export function Card({ title, subtitle, action, children, className = '', pad = true }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const RISK_ICON = { Critical: OctagonAlert, High: TriangleAlert, Medium: CircleAlert, Low: CircleCheck, Info }

export function RiskBadge({ level, score, className = '' }) {
  const Icon = RISK_ICON[level] || Info
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${RISK[level]?.cls} ${className}`}>
      <Icon size={12} strokeWidth={2.5} />
      {level}
      {score != null && <span className="tabular font-bold">· {score}</span>}
    </span>
  )
}

export function StatusBadge({ status }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${STATUS[status] || 'bg-slate-100'}`}>{status}</span>
}

export function NetworkBadge({ network, long = false }) {
  const n = NETWORKS[network]
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${n?.chip}`}>
      {long ? n?.name : network}
    </span>
  )
}

export function PriorityBadge({ p }) {
  const cls = p === 'P1' ? 'bg-navy-900 text-white' : p === 'P2' ? 'bg-navy-600 text-white' : 'bg-slate-200 text-slate-700'
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${cls}`}>{p}</span>
}

export function CopyBtn({ text, size = 13 }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      title="Copy"
      aria-label="Copy to clipboard"
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (await copyText(text)) {
          setOk(true)
          setTimeout(() => setOk(false), 1200)
        }
      }}
      className="rounded p-1 text-ink-3 hover:bg-slate-100 hover:text-ink"
    >
      {ok ? <Check size={size} className="text-good" /> : <Copy size={size} />}
    </button>
  )
}

export function Address({ value, head = 8, tail = 6, link = true, copy = true, full = false, className = '' }) {
  if (!value) return <span className="text-ink-3">-</span>
  const txt = full ? value : short(value, head, tail)
  return (
    <span className={`inline-flex min-w-0 items-center gap-0.5 font-mono text-[12.5px] ${className}`}>
      {link ? (
        <Link to={`/wallets/${value}`} className={`${full ? 'break-all' : 'truncate'} text-brand-700 hover:underline`} title={value}>
          {txt}
        </Link>
      ) : (
        <span className={full ? 'break-all' : 'truncate'} title={value}>{txt}</span>
      )}
      {copy && <CopyBtn text={value} size={12} />}
    </span>
  )
}

export function Stat({ label, value, sub, icon: Icon, tone }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      {Icon && (
        <div className={`grid size-9 shrink-0 place-items-center rounded-lg ${tone || 'bg-brand-50 text-brand-600'}`}>
          <Icon size={18} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xs font-medium text-ink-2">{label}</div>
        <div className="mt-0.5 text-2xl font-bold tracking-tight text-navy-900">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
      </div>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const on = t.id === value
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
              on ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            {t.icon && <t.icon size={15} />}
            {t.label}
            {t.count != null && <span className={`rounded-full px-1.5 text-[11px] ${on ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-ink-2'}`}>{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-ink-2">
      <LoaderCircle size={18} className="animate-spin text-brand-600" /> {label}
    </div>
  )
}

export function ErrorBox({ error }) {
  return (
    <div className="card flex items-start gap-3 border-red-200 bg-red-50 p-4 text-sm text-critical-ink">
      <OctagonAlert size={18} className="mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold">Could not load data</div>
        <div className="mt-0.5">{String(error?.message || error)}</div>
      </div>
    </div>
  )
}

export function Empty({ children }) {
  return <div className="py-10 text-center text-sm text-ink-3">{children}</div>
}

export function ConfidenceBar({ value, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="tabular text-xs font-semibold text-ink">{Math.round(value * 100)}%</span>
    </div>
  )
}

export function Field({ label, hint, children, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-2">
        {label} {required && <span className="text-critical">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}
