import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Building2, CircleCheck, Database, Gauge, GitBranch, LoaderCircle, Network, ScanSearch, Waypoints } from 'lucide-react'
import { getCase } from '../lib/api'
import { NETWORKS, inrShort, short } from '../lib/format'
import { Card, ErrorBox, Loading, PageHeader, btn, useAsync } from '../components/ui'

// Mirrors the Celery pipeline stages of the real backend
function buildSteps(d) {
  const c = d.case
  const net = NETWORKS[c.network].name
  const maxHop = Math.max(...d.nodes.map((n) => n.hop))
  const byHop = {}
  d.nodes.forEach((n) => { if (n.hop >= 1) byHop[n.hop] = (byHop[n.hop] || 0) + 1 })
  const n0 = d.attributions[0]
  return [
    { icon: Database, t: 'Fetching transactions', src: c.network === 'BTC' ? 'Blockchair API' : c.network === 'TRON' ? 'TRON API' : 'Etherscan V2 / Blockscout',
      logs: [`Connected to ${net} data source`, `Wallet ${short(c.reported_wallet, 10, 6)}: ${d.transactions.filter((t) => t.to_address === c.reported_wallet || t.from_address === c.reported_wallet).length} transactions found`, `Received ${inrShort(d.pool_inr)} in total from ${d.nodes.filter((n) => n.hop === -1).length} source wallet(s)`] },
    { icon: GitBranch, t: 'Tracing multi-hop fund flow', src: 'Tracing engine (Celery worker)',
      logs: Object.entries(byHop).slice(0, 7).map(([h, n]) => `Hop ${h}: ${n} wallet(s) followed`).concat([
        c.trace_depth && maxHop > c.trace_depth
          ? `Depth auto-extended from ${c.trace_depth} to ${maxHop} hops to reach an exchange deposit`
          : `Deepest hop reached: ${maxHop}`,
      ]) },
    { icon: Network, t: 'Building transaction graph', src: 'NetworkX → Neo4j',
      logs: [`${d.nodes.length} nodes, ${d.transactions.length} edges written to graph store`, 'Computed flow values and time ordering per edge'] },
    { icon: ScanSearch, t: 'Detecting patterns & clustering wallets', src: 'Pattern rules + clustering heuristics',
      logs: [...d.patterns.map((p) => `Pattern: ${p.type} (${p.severity})`), `${d.clusters.length} wallet cluster(s) formed`] },
    { icon: Building2, t: 'Attributing exchanges (VASPs)', src: 'Address-label DB + hot-wallet sweep matching',
      logs: n0 ? d.attributions.map((a) => `${a.exchange}: deposit reached at hop ${a.hops}, ${Math.round(a.confidence * 100)}% confidence`) : ['No exchange deposit found within trace depth - funds are held in wallets'] },
    { icon: Gauge, t: 'Scoring risk', src: d.risk.model,
      logs: [`Risk score ${d.risk.score}/100 (${d.risk.level})`, `Top factor: ${d.risk.factors[0].feature}`] },
  ]
}

export default function Analysis() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { data, error, loading } = useAsync(() => getCase(id), [id])
  const steps = useMemo(() => (data ? buildSteps(data) : []), [data])
  const [cur, setCur] = useState(0)
  const [logs, setLogs] = useState([])
  const logRef = useRef(null)

  useEffect(() => {
    if (!steps.length) return
    let alive = true
    let i = 0
    const timers = []
    const run = () => {
      if (!alive) return
      if (i >= steps.length) { setCur(steps.length); return }
      setCur(i)
      const s = steps[i]
      s.logs.forEach((l, j) => timers.push(setTimeout(() => alive && setLogs((x) => [...x, { step: i, t: l }]), 250 + j * (900 / s.logs.length))))
      i++
      timers.push(setTimeout(run, 1300))
    }
    run()
    return () => { alive = false; timers.forEach(clearTimeout) }
  }, [steps])

  useEffect(() => { logRef.current?.scrollTo({ top: 1e6, behavior: 'smooth' }) }, [logs])

  const done = cur >= steps.length && steps.length > 0
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => nav(`/cases/${id}`), 1800)
    return () => clearTimeout(t)
  }, [done, id, nav])

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  const c = data.case
  const pctDone = Math.round((Math.min(cur, steps.length) / steps.length) * 100)

  return (
    <>
      <PageHeader
        eyebrow={`Case ${c.id}`}
        title={done ? 'Trace complete' : 'Analysis in progress'}
        subtitle={
          params.get('existing')
            ? 'This wallet is already part of an existing case. Re-running the trace for the latest on-chain data.'
            : `Tracing ${NETWORKS[c.network].name} wallet ${short(c.reported_wallet, 10, 8)}`
        }
        actions={<Link to={`/cases/${id}`} className={btn.secondary}>Skip to results <ArrowRight size={15} /></Link>}
      />
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-brand-600 transition-all duration-700" style={{ width: `${pctDone}%` }} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Pipeline" subtitle="Each stage runs as a Celery task in the backend">
          <ol className="space-y-1">
            {steps.map((s, i) => {
              const state = i < cur ? 'done' : i === cur ? 'run' : 'wait'
              return (
                <li key={s.t} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${state === 'run' ? 'bg-brand-50' : ''}`}>
                  <div className={`grid size-9 shrink-0 place-items-center rounded-full ${state === 'done' ? 'bg-green-50 text-good' : state === 'run' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink-3'}`}>
                    {state === 'done' ? <CircleCheck size={18} /> : state === 'run' ? <LoaderCircle size={18} className="animate-spin" /> : <s.icon size={17} />}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold ${state === 'wait' ? 'text-ink-3' : 'text-ink'}`}>{s.t}</div>
                    <div className="text-xs text-ink-3">{s.src}</div>
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>
        <Card title="Live log" pad={false}>
          <div ref={logRef} className="h-[380px] overflow-y-auto bg-navy-950 p-4 font-mono text-[12px] leading-relaxed text-brand-100">
            {logs.map((l, i) => (
              <div key={i} className="slide-in">
                <span className="text-brand-500">[{String(l.step + 1).padStart(2, '0')}]</span> {l.t}
              </div>
            ))}
            {done && (
              <div className="mt-3 text-green-400">
                ✔ Trace complete. {data.attributions[0] ? `Nearest VASP: ${data.attributions[0].exchange}.` : 'No VASP reached yet.'} Opening workspace…
              </div>
            )}
            {!done && <span className="caret" />}
          </div>
        </Card>
      </div>
      {done && (
        <div className="mt-5 flex justify-center">
          <Link to={`/cases/${id}`} className={btn.primary}><Waypoints size={16} /> Open investigation workspace</Link>
        </div>
      )}
    </>
  )
}
