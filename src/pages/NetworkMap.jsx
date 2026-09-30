import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, Layers, Network } from 'lucide-react'
import { getNxGlobal } from '../lib/api'
import { ROLES, inrShort } from '../lib/format'
import { Address, Card, ErrorBox, Loading, NetworkBadge, PageHeader, Stat, useAsync } from '../components/ui'
import { CATEGORICAL } from '../components/NxGraphView'
import { RoleGlyph } from '../components/TxGraph'

const W = 1000
const H = 560
const PAD = 40

export default function NetworkMap() {
  const nav = useNavigate()
  const { data, error, loading } = useAsync(getNxGlobal, [])
  const [hover, setHover] = useState(null)
  const [focus, setFocus] = useState(null) // group id

  const g = useMemo(() => {
    if (!data) return null
    const maxLost = Math.max(...data.case_nodes.map((n) => n.amount_lost_inr))
    const nodes = data.case_nodes.map((n) => ({
      ...n,
      x: PAD + n.pos[0] * (W - 2 * PAD),
      y: PAD + (1 - n.pos[1]) * (H - 2 * PAD),
      r: 6 + 16 * Math.sqrt(n.amount_lost_inr / maxLost),
    }))
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
    return { nodes, byId, edges: data.case_edges.map((e) => ({ ...e, s: byId[e.source], t: byId[e.target] })) }
  }, [data])

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  const s = data.stats
  const dim = (grp) => focus != null && grp !== focus

  return (
    <>
      <PageHeader
        eyebrow="NetworkX · cross-case analysis"
        title="Network map"
        subtitle="Every case graph merged into one NetworkX graph. Two cases are linked when they share a wallet the fraudsters control."
        actions={<a href="/data/nx/png/global_case_links.png" download className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"><Download size={15} /> PNG (matplotlib)</a>}
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Stat icon={Network} label="Wallets in merged graph" value={s.wallets} sub={`${s.transfers} transfer edges`} />
        <Stat icon={Layers} label="Linked groups found" value={s.linked_groups} sub="nx.connected_components" tone="bg-red-50 text-critical" />
        <Stat label="Cases in linked groups" value={`${s.linked_cases} / ${s.cases}`} sub="Probably the same operators" />
        <Stat label="Shared fraudster wallets" value={s.shared_wallets} sub="Exchanges, mixers and bridges excluded" />
        <Stat label="Case-to-case links" value={s.case_link_edges} sub="Edges in the case graph" />
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        <Card title="Cases linked by shared wallets" subtitle="Node = case (size = amount lost) · colour = linked group · grey = no link found · click to open" pad={false}>
          <div className="relative bg-[#fbfcfe]">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Case link graph">
              {g.edges.map((e) => (
                <line key={e.source + e.target} x1={e.s.x} y1={e.s.y} x2={e.t.x} y2={e.t.y}
                  stroke="#b8c0cc" strokeWidth={1 + e.shared_wallets} opacity={dim(e.s.group) ? 0.15 : 0.8} />
              ))}
              {g.nodes.map((n) => {
                const linked = n.group != null
                return (
                  <g key={n.id} transform={`translate(${n.x},${n.y})`} className="cursor-pointer" opacity={dim(n.group) ? 0.2 : 1}
                    onClick={() => nav(`/cases/${n.id}`)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)}>
                    <circle r={n.r} fill={linked ? CATEGORICAL[n.group % 8] : '#d5d9e0'} stroke="#fff" strokeWidth="2" />
                    {linked && (
                      <text y={n.r + 12} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#0f172a" stroke="#fff" strokeWidth="3" paintOrder="stroke">{n.id.slice(-4)}</text>
                    )}
                  </g>
                )
              })}
            </svg>
            {hover && (
              <div className="pointer-events-none absolute top-3 left-3 w-64 rounded-lg bg-navy-900 p-3 text-xs text-brand-100 shadow-lg">
                <div className="font-semibold text-white">{hover.id}</div>
                <div className="mt-1 grid grid-cols-2 gap-y-0.5">
                  <span>Network</span><span className="text-right text-white">{hover.network}</span>
                  <span>Amount lost</span><span className="text-right text-white">{inrShort(hover.amount_lost_inr)}</span>
                  <span>Risk</span><span className="text-right text-white">{hover.risk_score}</span>
                  <span>Nearest VASP</span><span className="text-right text-white">{hover.nearest_exchange || '-'}</span>
                  <span>Linked cases</span><span className="text-right text-white">{hover.degree}</span>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {data.groups.map((grp) => (
            <Card key={grp.id} className={focus === grp.id ? 'ring-2 ring-brand-500' : ''}>
              <button className="flex w-full items-center justify-between text-left" onClick={() => setFocus(focus === grp.id ? null : grp.id)}>
                <span className="flex items-center gap-2 font-semibold text-navy-900">
                  <span className="size-3 rounded-full" style={{ background: CATEGORICAL[grp.id % 8] }} /> Linked group {grp.id + 1}
                </span>
                <span className="text-xs text-ink-3">{focus === grp.id ? 'Show all' : 'Focus'}</span>
              </button>
              <div className="mt-2 text-sm text-ink-2">{grp.size} cases · {inrShort(grp.total_lost_inr)} lost · {grp.networks.join(', ')}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {grp.cases.map((c) => <Link key={c} to={`/cases/${c}`} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700 hover:underline">{c}</Link>)}
              </div>
              <div className="mt-3 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Shared wallet{grp.shared_wallets.length > 1 ? 's' : ''}</div>
              {grp.shared_wallets.map((w) => <Address key={w} value={w} head={10} tail={6} />)}
              {grp.exchanges.length > 0 && <div className="mt-2 text-xs text-ink-3">Cash-out via {grp.exchanges.join(', ')}</div>}
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Most connected wallets" subtitle="Degree in the merged NetworkX graph" pad={false}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-ink-2">
              <tr>{['Wallet', 'Role', 'Degree', 'Cases'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.top_wallets.map((w) => (
                <tr key={w.id}>
                  <td className="px-3 py-2"><span className="flex items-center gap-1.5"><NetworkBadge network={w.network} /><Address value={w.id} head={6} tail={4} copy={false} /></span></td>
                  <td className="px-3 py-2 text-xs"><span className="inline-flex items-center gap-1"><RoleGlyph role={w.role} size={10} />{w.entity || ROLES[w.role].label}</span></td>
                  <td className="tabular px-3 py-2">{w.degree}</td>
                  <td className="tabular px-3 py-2 text-xs">{w.cases.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="How this was computed">
          <dl className="space-y-2 text-sm">
            {Object.entries(data.algorithm_notes).map(([k, v]) => (
              <div key={k}><dt className="text-xs font-semibold text-ink-3 uppercase">{k.replace('_', ' ')}</dt><dd className="text-ink-2">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-ink-3">Regenerate with <code className="font-mono">npm run gen-graphs</code> after changing the dummy data.</p>
        </Card>
      </div>
    </>
  )
}
