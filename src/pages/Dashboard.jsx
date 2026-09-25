import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, FolderOpen, IndianRupee, OctagonAlert, Plus, Siren, Snowflake } from 'lucide-react'
import { getDailyStats, listAlerts, listCases, listExchanges, subscribe } from '../lib/api'
import { ago, inrShort, num, STATUS_ORDER, NETWORKS, FRAUD_SHORT } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { Card, ErrorBox, Loading, NetworkBadge, PageHeader, RiskBadge, Stat, StatusBadge, btn, useAsync } from '../components/ui'
import { HBar, TrendLine } from '../components/charts'

export default function Dashboard() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [range, setRange] = useState(30)
  const { data, error, loading } = useAsync(() => Promise.all([listCases(), getDailyStats(), listExchanges()]), [])
  const [alerts, setAlerts] = useState([])
  useEffect(() => {
    const load = () => listAlerts().then(setAlerts)
    load()
    return subscribe(load)
  }, [])

  const m = useMemo(() => {
    if (!data) return null
    const [cases, daily, exchanges] = data
    const active = cases.filter((c) => c.status !== 'Closed')
    const byNet = Object.keys(NETWORKS).map((n) => [n, cases.filter((c) => c.network === n).length])
    const byFraud = Object.entries(cases.reduce((a, c) => ({ ...a, [c.fraud_type]: (a[c.fraud_type] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])
    const exRank = [...exchanges].sort((a, b) => b.total_inr_received - a.total_inr_received).slice(0, 8)
    return {
      cases, daily, exRank, byNet, byFraud,
      active: active.length,
      highRisk: active.filter((c) => c.risk_score >= 60).length,
      vasp: cases.filter((c) => c.nearest_exchange).length,
      traced: cases.reduce((s, c) => s + c.traced_to_vasp_inr, 0),
      frozen: cases.reduce((s, c) => s + c.frozen_inr, 0),
      pipeline: STATUS_ORDER.map((s) => [s, cases.filter((c) => c.status === s).length]),
      recent: [...cases].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 7),
    }
  }, [data])

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />

  const daily = m.daily.slice(-range)
  const unread = alerts.filter((a) => !a.read).length

  return (
    <>
      <PageHeader
        eyebrow="Command dashboard"
        title={`Good morning, ${user.name.split(' ')[0]}`}
        subtitle={`${m.active} active investigations · ${unread} unread alerts · ${user.unit}`}
        actions={<Link to="/investigate" className={btn.primary}><Plus size={16} /> New investigation</Link>}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Stat icon={FolderOpen} label="Active cases" value={m.active} sub={`${m.cases.length} total in unit`} />
        <Stat icon={OctagonAlert} label="High / critical risk" value={m.highRisk} sub="Risk score ≥ 60" tone="bg-red-50 text-critical" />
        <Stat icon={Building2} label="Cases with VASP identified" value={m.vasp} sub={`${Math.round((100 * m.vasp) / m.cases.length)}% attribution rate`} />
        <Stat icon={IndianRupee} label="Traced to exchanges" value={inrShort(m.traced)} sub="Across all cases" />
        <Stat icon={Snowflake} label="Funds frozen" value={inrShort(m.frozen)} sub="Via exchange notices" tone="bg-teal-50 text-teal-700" />
      </div>

      <Card className="mt-5" title="Case pipeline" subtitle="Where each investigation stands right now" pad={false}>
        <div className="grid grid-cols-2 divide-line sm:grid-cols-4 lg:grid-cols-7 lg:divide-x">
          {m.pipeline.map(([s, n], i) => (
            <button key={s} onClick={() => nav(`/cases?status=${encodeURIComponent(s)}`)} className="group px-4 py-3.5 text-left hover:bg-slate-50">
              <div className="text-[11px] font-medium text-ink-3">{i + 1}. {s}</div>
              <div className="mt-0.5 flex items-baseline gap-1 text-2xl font-bold text-navy-900">
                {n}
                <ArrowRight size={14} className="text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </button>
          ))}
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Crypto-fraud complaints ingested from NCRP"
          subtitle="National feed, per day"
          action={
            <div className="flex rounded-lg border border-line p-0.5 text-xs">
              {[30, 90].map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`rounded-md px-2.5 py-1 font-medium ${range === r ? 'bg-navy-900 text-white' : 'text-ink-2 hover:text-ink'}`}>
                  {r} days
                </button>
              ))}
            </div>
          }
        >
          <TrendLine
            label="Complaints"
            labels={daily.map((d) => new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }))}
            values={daily.map((d) => d.complaints)}
            format={(v) => num(v)}
            height={250}
          />
          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3 text-center">
            <div><div className="text-xs text-ink-3">Wallets traced ({range}d)</div><div className="font-bold text-navy-900">{num(daily.reduce((s, d) => s + d.wallets_traced, 0))}</div></div>
            <div><div className="text-xs text-ink-3">VASPs identified ({range}d)</div><div className="font-bold text-navy-900">{num(daily.reduce((s, d) => s + d.vasps_identified, 0))}</div></div>
            <div><div className="text-xs text-ink-3">Amount traced ({range}d)</div><div className="font-bold text-navy-900">₹{num(daily.reduce((s, d) => s + d.amount_traced_cr, 0), 1)} Cr</div></div>
          </div>
        </Card>

        <Card title="Live alerts" subtitle="Watchlisted wallets" action={<Link to="/watchlist" className={btn.ghost}>View all <ArrowRight size={14} /></Link>} pad={false}>
          <ul className="divide-y divide-line">
            {alerts.slice(0, 6).map((a) => (
              <li key={a.id} className={`px-5 py-3 ${a.live ? 'slide-in bg-brand-50/50' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <RiskBadge level={a.severity} />
                  <span className="text-[11px] text-ink-3">{ago(a.at)}</span>
                </div>
                <div className="mt-1.5 text-sm text-ink">{a.message}</div>
                <Link to={`/cases/${a.case_id}`} className="mt-0.5 inline-block text-xs text-brand-700 hover:underline">{a.case_id}</Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Exchanges receiving traced funds" subtitle="Total ₹ reaching each VASP · click a bar for details">
          <HBar label="Received" labels={m.exRank.map((e) => e.name)} values={m.exRank.map((e) => e.total_inr_received)} format={inrShort} onClick={() => nav('/exchanges')} />
        </Card>
        <Card title="Cases by fraud type">
          <HBar label="Cases" labels={m.byFraud.map(([k]) => FRAUD_SHORT[k] || k)} values={m.byFraud.map(([, v]) => v)} />
        </Card>
        <Card title="Cases by blockchain network">
          <HBar label="Cases" labels={m.byNet.map(([k]) => NETWORKS[k].name)} values={m.byNet.map(([, v]) => v)} />
        </Card>
      </div>

      <Card className="mt-5" title="Recently opened cases" action={<Link to="/cases" className={btn.ghost}>All cases <ArrowRight size={14} /></Link>} pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-ink-2">
              <tr>
                {['Case', 'Fraud type', 'Network', 'Amount lost', 'Nearest VASP', 'Risk', 'Status', 'Opened'].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {m.recent.map((c) => (
                <tr key={c.id} onClick={() => nav(`/cases/${c.id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold whitespace-nowrap text-brand-700">{c.id}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{FRAUD_SHORT[c.fraud_type]}</td>
                  <td className="px-4 py-2.5"><NetworkBadge network={c.network} /></td>
                  <td className="tabular px-4 py-2.5 whitespace-nowrap">{inrShort(c.amount_lost_inr)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{c.nearest_exchange || <span className="text-ink-3">Not yet reached</span>}</td>
                  <td className="px-4 py-2.5"><RiskBadge level={c.risk_level} score={c.risk_score} /></td>
                  <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-3">{ago(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-3"><Siren size={13} /> Figures are demo data generated for the SIH26183 prototype.</p>
    </>
  )
}
