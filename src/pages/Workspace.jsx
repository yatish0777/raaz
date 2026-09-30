import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Activity, ArrowRight, BadgeCheck, Building2, Clock, FileText, Gauge, GitBranch, Globe, Layers, Network, Radar, Route, ScanSearch,
  TableProperties, TriangleAlert, Users, Waypoints,
} from 'lucide-react'
import { addToWatchlist, getCase, listExchanges } from '../lib/api'
import { NETWORKS, ROLES, dt, inr, inrShort, token } from '../lib/format'
import {
  Address, Card, ErrorBox, Loading, NetworkBadge, PriorityBadge, RiskBadge, StatusBadge, Tabs, btn, useAsync,
} from '../components/ui'
import TxGraph, { RoleGlyph } from '../components/TxGraph'
import NxTab from './workspace/NxTab'
import { AttributionTab, ClustersTab, FundFlowTab, PatternsTab, RiskTab, TimelineTab, TransactionsTab } from './workspace/tabs'

/** Wallets on any path from the reported wallet to the nearest exchange (+ its hot-wallet sweep) */
function pathToNearest(d) {
  const n0 = d.attributions[0]
  if (!n0) return new Set()
  const hopOf = Object.fromEntries(d.nodes.map((n) => [n.address, n.hop]))
  const incoming = {}
  d.transactions.forEach((t) => (incoming[t.to_address] ??= []).push(t.from_address))
  const set = new Set(n0.deposit_addresses)
  const q = [...n0.deposit_addresses]
  while (q.length) {
    const a = q.pop()
    for (const f of incoming[a] || []) {
      if (hopOf[f] >= 0 && !set.has(f)) { set.add(f); q.push(f) }
    }
  }
  d.transactions.forEach((t) => { if (t.kind === 'exchange_sweep' && n0.deposit_addresses.includes(t.from_address)) set.add(t.to_address) })
  return set
}

function NodePanel({ node, d, onClose }) {
  const [added, setAdded] = useState(false)
  const c = d.case
  const tok = node.network === c.network ? c.token : d.transactions.find((t) => t.to_address === node.address)?.token
  return (
    <div className="slide-in space-y-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-900"><RoleGlyph role={node.role} /> {ROLES[node.role].label}</span>
        <button onClick={onClose} className={btn.ghost}>Close</button>
      </div>
      {node.entity && <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">{node.entity}</div>}
      <div className="text-xs text-ink-3">{node.label}</div>
      <div className="rounded-lg bg-slate-50 p-2.5 font-mono text-[11.5px] break-all text-ink">{node.address}</div>
      <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
        <dt className="text-ink-3">Network</dt><dd className="text-right"><NetworkBadge network={node.network} /></dd>
        <dt className="text-ink-3">Hop</dt><dd className="text-right font-semibold">{node.hop < 0 ? 'Source' : node.hop}</dd>
        <dt className="text-ink-3">Received</dt><dd className="text-right font-semibold">{inrShort(node.in_inr)}</dd>
        <dt className="text-ink-3">Sent</dt><dd className="text-right font-semibold">{inrShort(node.out_inr)}</dd>
        {node.balance != null && <><dt className="text-ink-3">Balance left</dt><dd className="text-right font-semibold">{token(node.balance, tok)}</dd></>}
        <dt className="text-ink-3">Transactions</dt><dd className="text-right">{node.tx_count}</dd>
        <dt className="text-ink-3">First seen</dt><dd className="text-right text-xs">{dt(node.first_seen)}</dd>
        <dt className="text-ink-3">Last seen</dt><dd className="text-right text-xs">{dt(node.last_seen)}</dd>
        {node.cluster_id && <><dt className="text-ink-3">Cluster</dt><dd className="text-right font-mono text-xs">{node.cluster_id}</dd></>}
      </dl>
      <div className="flex flex-col gap-2 pt-1">
        <Link to={`/wallets/${node.address}`} className={btn.secondary}>Open wallet profile <ArrowRight size={14} /></Link>
        {!['victim', 'exchange_hot', 'mixer', 'bridge'].includes(node.role) && (
          <button
            className={btn.secondary}
            disabled={added}
            onClick={async () => {
              await addToWatchlist({ address: node.address, network: node.network, case_id: c.id, label: ROLES[node.role].label, reason: `Flagged from graph of ${c.id}`, risk_score: c.risk_score, balance: node.balance, token: tok })
              setAdded(true)
            }}
          >
            <Radar size={14} /> {added ? 'Added to watchlist' : 'Add to watchlist'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Workspace() {
  const { id } = useParams()
  const { data, error, loading } = useAsync(() => Promise.all([getCase(id), listExchanges()]), [id])
  const [tab, setTab] = useState('graph')
  const [sel, setSel] = useState(null)
  const [showPath, setShowPath] = useState(true)
  const d = data?.[0]
  const exchanges = data?.[1]
  const path = useMemo(() => (d ? pathToNearest(d) : new Set()), [d])
  const rolesPresent = useMemo(() => (d ? Object.keys(ROLES).filter((r) => d.nodes.some((n) => n.role === r)) : []), [d])

  if (loading) return <Loading label="Loading investigation…" />
  if (error) return <ErrorBox error={error} />
  const c = d.case
  const n0 = d.attributions[0]
  const selNode = sel && d.nodes.find((n) => n.address === sel.address)

  const TABS = [
    { id: 'graph', label: 'Transaction graph', icon: Waypoints },
    { id: 'nx', label: 'NetworkX analysis', icon: Network },
    { id: 'flow', label: 'Fund flow', icon: Route },
    { id: 'tx', label: 'Transactions', icon: TableProperties, count: d.transactions.length },
    { id: 'patterns', label: 'Patterns', icon: ScanSearch, count: d.patterns.length },
    { id: 'clusters', label: 'Wallet clusters', icon: Users, count: d.clusters.length },
    { id: 'attr', label: 'Exchange attribution', icon: Building2, count: d.attributions.length },
    { id: 'risk', label: 'Risk score', icon: Gauge },
    { id: 'timeline', label: 'Timeline & legal', icon: Clock },
  ]

  return (
    <>
      {/* header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <Link to="/cases" className="hover:text-ink">Cases</Link> / <span className="font-semibold text-ink-2">{c.id}</span>
            {c.demo_generated && <span className="rounded bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-700">Demo-generated result</span>}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-900">{c.fraud_type}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={c.status} />
            <PriorityBadge p={c.priority} />
            <RiskBadge level={c.risk_level} score={c.risk_score} />
            <NetworkBadge network={c.network} long />
            <span className="text-ink-3">·</span>
            <span className="text-ink-2">NCRP {c.ncrp_ack}</span>
            <span className="text-ink-3">·</span>
            <span className="text-ink-2">{c.district}, {c.state}</span>
            <span className="text-ink-3">·</span>
            <span className="text-ink-2">IO: {c.investigator}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/reports/${c.id}`} className={btn.primary}><FileText size={16} /> Generate report</Link>
        </div>
      </div>

      {/* nearest VASP banner */}
      {n0 ? (
        <div className="mb-5 overflow-hidden rounded-xl bg-navy-900 text-white">
          <div className="flex flex-wrap items-center gap-6 p-5">
            <div className="flex items-center gap-4">
              <div className="grid size-12 place-items-center rounded-xl bg-brand-600"><Building2 size={24} /></div>
              <div>
                <div className="text-[11px] font-semibold tracking-wider text-brand-200 uppercase">Nearest probable exchange (VASP)</div>
                <div className="text-2xl font-bold">{n0.exchange}</div>
                <div className="mt-0.5 flex items-center gap-2 text-sm text-brand-100/80">
                  {n0.fiu_ind_registered ? <BadgeCheck size={14} className="text-green-400" /> : <Globe size={14} className="text-amber-300" />}
                  {n0.jurisdiction} · {n0.fiu_ind_registered ? 'FIU-IND registered' : 'Not registered in India'}
                </div>
              </div>
            </div>
            <div className="grid min-w-0 basis-full grid-cols-2 gap-4 sm:grid-cols-4 lg:basis-0 lg:flex-1">
              <div><div className="text-xs text-brand-200">Hops away</div><div className="text-xl font-bold">{n0.hops}</div></div>
              <div><div className="text-xs text-brand-200">Amount reached</div><div className="text-xl font-bold">{inrShort(n0.amount_inr)}</div></div>
              <div><div className="text-xs text-brand-200">Complainant's share</div><div className="text-xl font-bold">{inrShort(n0.victim_attributable_inr)}</div></div>
              <div>
                <div className="text-xs text-brand-200">Confidence</div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-navy-700"><div className="h-full rounded-full bg-green-400" style={{ width: `${n0.confidence * 100}%` }} /></div>
                  <span className="text-xl font-bold">{Math.round(n0.confidence * 100)}%</span>
                </div>
              </div>
            </div>
            <Link to={`/reports/${c.id}?tab=notice`} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-brand-50">
              Draft notice <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-warn-ink">
          <TriangleAlert size={20} className="shrink-0" />
          <div><div className="font-semibold">No exchange reached yet</div>{inr(c.held_in_wallets_inr)} is still in layering wallets. The wallets are on the watchlist and RAAZ will alert you when funds move towards an exchange.</div>
        </div>
      )}

      {/* summary strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['Amount lost', inr(c.amount_lost_inr), `${token(c.amount_lost_token, c.token)} · ${c.payments} payment(s)`],
          ['Wallets traced', c.wallets_traced, `${c.transactions_traced} transactions`],
          ['Max hop depth', Math.max(...d.nodes.map((n) => n.hop)), NETWORKS[c.network].name],
          ['Traced to VASPs', inrShort(c.traced_to_vasp_inr), `${d.attributions.length} exchange(s)`],
          ['Held in wallets', inrShort(c.held_in_wallets_inr), 'Can still move'],
          ['Frozen', inrShort(c.frozen_inr), c.frozen_inr ? 'At exchange' : 'Nothing frozen yet'],
        ].map(([k, v, s]) => (
          <div key={k} className="card px-4 py-3">
            <div className="text-xs text-ink-3">{k}</div>
            <div className="text-lg font-bold text-navy-900">{v}</div>
            <div className="truncate text-[11px] text-ink-3">{s}</div>
          </div>
        ))}
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === 'graph' && (
          <div className="space-y-5">
            <Card pad={false}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm text-ink-2">
                  <GitBranch size={15} /> {d.nodes.length} wallets · {d.transactions.length} transactions · left to right = hops away from the reported wallet
                </div>
                {n0 && (
                  <label className="flex items-center gap-2 text-sm font-medium text-ink">
                    <input type="checkbox" className="size-4 accent-brand-600" checked={showPath} onChange={(e) => setShowPath(e.target.checked)} />
                    Highlight path to {n0.exchange}
                  </label>
                )}
              </div>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line bg-slate-50/60 px-4 py-2 text-xs text-ink-2">
                {rolesPresent.map((r) => (
                  <li key={r} className="flex items-center gap-1.5"><RoleGlyph role={r} size={12} /> {ROLES[r].label}</li>
                ))}
                <li className="flex items-center gap-1.5"><svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#7b8699" strokeWidth="2" strokeDasharray="4 3" /></svg> Probabilistic link (mixer)</li>
                <li className="flex items-center gap-1.5"><svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#1d4ed8" strokeWidth="3" /></svg> Path to nearest exchange</li>
                <li className="text-ink-3">Line thickness = value</li>
              </ul>
              <div className="relative">
                <TxGraph
                  nodes={d.nodes}
                  transactions={d.transactions}
                  highlight={showPath ? path : null}
                  selected={sel?.address}
                  onSelect={setSel}
                  height={560}
                />
                {selNode ? (
                  <div className="absolute top-3 left-3 max-h-[calc(100%-24px)] w-80 overflow-y-auto rounded-xl border border-line bg-white p-4 shadow-lg">
                    <NodePanel key={selNode.address} node={selNode} d={d} onClose={() => setSel(null)} />
                  </div>
                ) : (
                  <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs text-ink-2 shadow-sm ring-1 ring-line">
                    <Activity size={13} /> Click a wallet for details · hover to see its counterparties · Ctrl + scroll to zoom · drag to pan
                  </div>
                )}
              </div>
            </Card>
            <div className="grid gap-5 md:grid-cols-2">
              <Card title="Reported wallet">
                <Address value={c.reported_wallet} full />
                <div className="mt-3 text-xs text-ink-3">Complainant's wallet</div>
                <Address value={c.victim_wallet} full />
              </Card>
              {c.linked_cases.length > 0 ? (
                <Card title="Cross-case link" subtitle={`${c.syndicate}: same consolidation wallet`}>
                  <div className="flex items-start gap-2 text-sm text-critical-ink">
                    <Layers size={16} className="mt-0.5 shrink-0" />
                    <div>
                      Linked to {c.linked_cases.length} other case(s). These are probably the same operator.
                      <div className="mt-1.5 flex flex-wrap gap-1.5">{c.linked_cases.map((x) => <Link key={x} to={`/cases/${x}`} className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold hover:underline">{x}</Link>)}</div>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card title="Cross-case link"><div className="text-sm text-ink-3">No other RAAZ case shares wallets with this one.</div></Card>
              )}
            </div>
          </div>
        )}
        {tab === 'nx' && <NxTab d={d} />}
        {tab === 'flow' && <FundFlowTab d={d} />}
        {tab === 'tx' && <TransactionsTab d={d} />}
        {tab === 'patterns' && <PatternsTab d={d} />}
        {tab === 'clusters' && <ClustersTab d={d} />}
        {tab === 'attr' && <AttributionTab d={d} exchanges={exchanges} />}
        {tab === 'risk' && <RiskTab d={d} />}
        {tab === 'timeline' && <TimelineTab d={d} />}
      </div>
      <p className="mt-6 text-xs text-ink-3">Case description: {c.description}</p>
    </>
  )
}
