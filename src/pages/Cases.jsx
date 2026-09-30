import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Plus, Search, X } from 'lucide-react'
import { listCases } from '../lib/api'
import { FRAUD_SHORT, NETWORKS, STATUS_ORDER, dateOnly, inrShort, short } from '../lib/format'
import { Card, Empty, ErrorBox, Loading, NetworkBadge, PageHeader, PriorityBadge, RiskBadge, StatusBadge, btn, input, inputAuto, useAsync } from '../components/ui'

const COLS = [
  ['id', 'Case'], ['fraud_type', 'Fraud type'], ['network', 'Network'], ['reported_wallet', 'Reported wallet'], ['amount_lost_inr', 'Lost'],
  ['nearest_exchange', 'Nearest VASP'], ['risk_score', 'Risk'], ['status', 'Status'], ['investigator', 'IO'], ['reported_at', 'Reported'],
]

export default function Cases() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data, error, loading } = useAsync(listCases, [])
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState(['reported_at', -1])
  const f = {
    q: params.get('q') || '', status: params.get('status') || '', risk: params.get('risk') || '',
    network: params.get('network') || '', io: params.get('io') || '',
  }
  const setF = (k, v) => {
    const p = new URLSearchParams(params)
    v ? p.set(k, v) : p.delete(k)
    setParams(p, { replace: true })
    setPage(0)
  }

  const rows = useMemo(() => {
    if (!data) return []
    const q = f.q.toLowerCase()
    const r = data.filter((c) =>
      (!q || [c.id, c.ncrp_ack, c.reported_wallet, c.victim.name, c.fraud_type, c.nearest_exchange || '', c.state, c.district].some((x) => x.toLowerCase().includes(q))) &&
      (!f.status || c.status === f.status) && (!f.risk || c.risk_level === f.risk) && (!f.network || c.network === f.network) && (!f.io || c.investigator === f.io))
    const [k, dir] = sort
    return [...r].sort((a, b) => ((a[k] ?? '') > (b[k] ?? '') ? dir : (a[k] ?? '') < (b[k] ?? '') ? -dir : 0))
  }, [data, f.q, f.status, f.risk, f.network, f.io, sort])

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  const PER = 15
  const view = rows.slice(page * PER, page * PER + PER)
  const ios = [...new Set(data.map((c) => c.investigator))].sort()
  const anyFilter = Object.values(f).some(Boolean)

  return (
    <>
      <PageHeader
        title="Cases"
        subtitle={`${rows.length} of ${data.length} investigations`}
        actions={<Link to="/investigate" className={btn.primary}><Plus size={16} /> New investigation</Link>}
      />
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-64 flex-1">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <input className={`${input} pl-8`} placeholder="Search case ID, NCRP no., wallet, victim, exchange, place…" value={f.q} onChange={(e) => setF('q', e.target.value)} />
          </div>
          <select className={inputAuto} value={f.status} onChange={(e) => setF('status', e.target.value)}>
            <option value="">All statuses</option>{STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className={inputAuto} value={f.risk} onChange={(e) => setF('risk', e.target.value)}>
            <option value="">All risk levels</option>{['Critical', 'High', 'Medium', 'Low'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className={inputAuto} value={f.network} onChange={(e) => setF('network', e.target.value)}>
            <option value="">All networks</option>{Object.entries(NETWORKS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
          <select className={inputAuto} value={f.io} onChange={(e) => setF('io', e.target.value)}>
            <option value="">All officers</option>{ios.map((s) => <option key={s}>{s}</option>)}
          </select>
          {anyFilter && <button className={btn.ghost} onClick={() => { setParams({}); setPage(0) }}><X size={14} /> Clear</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-ink-2">
              <tr>
                {COLS.map(([k, l]) => (
                  <th key={k} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort(([sk, d]) => [k, sk === k ? -d : -1])}>
                      {l}
                      {sort[0] === k && (sort[1] > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {view.map((c) => (
                <tr key={c.id} onClick={() => nav(`/cases/${c.id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="font-semibold text-brand-700">{c.id}</div>
                    <div className="flex items-center gap-1 text-[11px] text-ink-3"><PriorityBadge p={c.priority} /> {c.victim.name}</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{FRAUD_SHORT[c.fraud_type]}<div className="text-[11px] text-ink-3">{c.district}, {c.state}</div></td>
                  <td className="px-3 py-2.5"><NetworkBadge network={c.network} /></td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-ink-2">{short(c.reported_wallet, 7, 5)}</td>
                  <td className="tabular px-3 py-2.5 whitespace-nowrap">{inrShort(c.amount_lost_inr)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {c.nearest_exchange ? <>{c.nearest_exchange}<div className="text-[11px] text-ink-3">{c.hops_to_exchange} hops · {Math.round(c.exchange_confidence * 100)}%</div></> : <span className="text-ink-3">Not reached</span>}
                  </td>
                  <td className="px-3 py-2.5"><RiskBadge level={c.risk_level} score={c.risk_score} /></td>
                  <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap text-ink-2">{c.investigator}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap text-ink-3">{dateOnly(c.reported_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty>No cases match these filters.</Empty>}
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-ink-2">
          <span>Showing {rows.length ? page * PER + 1 : 0}-{Math.min(rows.length, page * PER + PER)} of {rows.length}</span>
          <div className="flex gap-1">
            <button className={btn.ghost} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className={btn.ghost} disabled={(page + 1) * PER >= rows.length} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </Card>
    </>
  )
}
