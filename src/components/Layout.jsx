import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Bot, Building2, FileText, FolderSearch, LayoutDashboard, Menu, Network, Radar, Search, ShieldCheck, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listAlerts, search, startLiveFeed, subscribe } from '../lib/api'
import { checkOllama, getOllamaConfig } from '../lib/ollama'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/investigate', label: 'New Investigation', icon: Search },
  { to: '/cases', label: 'Cases', icon: FolderSearch },
  { to: '/watchlist', label: 'Watchlist & Alerts', icon: Radar, badge: 'alerts' },
  { to: '/network', label: 'Network Map', icon: Network },
  { to: '/exchanges', label: 'VASP Directory', icon: Building2 },
  { to: '/reports', label: 'Reports', icon: FileText },
]

export function Logo({ light = true, size = 'md' }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`grid place-items-center rounded-lg bg-brand-600 ${size === 'lg' ? 'size-11' : 'size-9'}`}>
        <ShieldCheck className="text-white" size={size === 'lg' ? 24 : 20} strokeWidth={2.2} />
      </div>
      <div className="leading-tight">
        <div className={`font-extrabold tracking-[0.18em] ${light ? 'text-white' : 'text-navy-900'} ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>RAAZ</div>
        <div className={`text-[10px] font-medium uppercase tracking-wider ${light ? 'text-brand-200' : 'text-ink-3'}`}>Automated Anti-Fraud Analysis</div>
      </div>
    </div>
  )
}

function useUnread() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const load = () => listAlerts().then((a) => setN(a.filter((x) => !x.read).length))
    load()
    return subscribe(load)
  }, [])
  return n
}

function OllamaStatus() {
  const [st, setSt] = useState(null)
  useEffect(() => {
    const run = () => checkOllama().then(setSt)
    run()
    const t = setInterval(run, 60000)
    return () => clearInterval(t)
  }, [])
  const cfg = getOllamaConfig()
  const ok = st?.ok
  return (
    <Link to="/reports" className="block rounded-lg bg-navy-800/70 px-3 py-2.5 text-xs hover:bg-navy-800">
      <div className="flex items-center gap-2 font-semibold text-white">
        <Bot size={14} /> Ollama (local LLM)
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-brand-200">
        <span className={`size-2 rounded-full ${st == null ? 'bg-slate-400' : ok ? 'bg-good live-dot' : 'bg-warn'}`} />
        {st == null ? 'Checking…' : ok ? `Connected · ${cfg.model}` : 'Offline · template mode'}
      </div>
    </Link>
  )
}

export default function Layout() {
  const { user } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const unread = useUnread()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => startLiveFeed(), [])
  useEffect(() => setOpen(false), [loc.pathname])

  const onSearch = async (e) => {
    e.preventDefault()
    const to = await search(q)
    if (to) {
      nav(to)
      setQ('')
    }
  }

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-navy-900 text-white">
      <div className="flex items-center justify-between px-5 py-5">
        <Logo />
        <button className="text-brand-200 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
      </div>
      <nav className="mt-2 flex-1 space-y-0.5 px-3">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-brand-100/80 hover:bg-navy-800 hover:text-white'
              }`
            }
          >
            <n.icon size={18} />
            <span className="flex-1">{n.label}</span>
            {n.badge === 'alerts' && unread > 0 && (
              <span className="rounded-full bg-critical px-1.5 text-[11px] font-bold text-white">{unread}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-3 px-3 pb-4">
        <OllamaStatus />
        <div className="px-2 text-[10.5px] leading-relaxed text-brand-200/60">
          Authorised law-enforcement use only. All actions are logged.
          <br />SIH26183 prototype · v0.1
        </div>
      </div>
    </aside>
  )

  return (
    <div className="app-shell flex h-full">
      <div className="no-print hidden lg:block">{sidebar}</div>
      {open && (
        <div className="no-print fixed inset-0 z-40 flex lg:hidden">
          {sidebar}
          <button className="flex-1 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print bg-amber-50 px-4 py-1 text-center text-[11.5px] font-medium text-warn-ink">
          DEMO DATA - all wallet addresses, hashes, people and exchange names are fictional
        </div>
        <header className="no-print flex items-center gap-3 border-b border-line bg-white px-4 py-2.5 lg:px-6">
          <button className="text-ink-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <form onSubmit={onSearch} className="relative max-w-xl flex-1">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search wallet address, case ID, NCRP ack no. or victim name…"
              className="w-full rounded-lg border border-line bg-page py-2 pr-3 pl-9 text-sm placeholder:text-ink-3 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100 focus:outline-none"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-good-ink md:inline-flex">
              <span className="live-dot size-2 rounded-full bg-good" /> Live monitoring
            </span>
            <Link to="/watchlist" className="relative rounded-lg p-2 text-ink-2 hover:bg-slate-100" aria-label={`${unread} unread alerts`}>
              <Bell size={19} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">{unread}</span>
              )}
            </Link>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-ink">{user.name}</div>
              <div className="text-[11px] text-ink-3">{user.rank} · {user.badge}</div>
            </div>
            <div className="grid size-9 place-items-center rounded-full bg-navy-900 text-sm font-bold text-white">
              {user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
