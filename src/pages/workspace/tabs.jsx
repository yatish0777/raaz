import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Building2, Download, FileText, Gavel, Globe, Link2, Search, ShieldAlert, Snowflake, UserRound } from 'lucide-react'
import { ROLES, TX_KIND, dt, inr, inrShort, num, short, token } from '../../lib/format'
import { Address, Card, ConfidenceBar, CopyBtn, Empty, RiskBadge, btn, input, inputAuto } from '../../components/ui'
import { HBar } from '../../components/charts'
import RiskGauge from '../../components/RiskGauge'
import { RoleGlyph } from '../../components/TxGraph'

// ---------------------------------------------------------------- Fund flow
export function FundFlowTab({ d }) {
  const c = d.case
  const hops = useMemo(() => {
    const byAddr = Object.fromEntries(d.nodes.map((n) => [n.address, n]))
    const rows = {}
    for (const n of d.nodes) {
      if (n.hop < 0) continue
      rows[n.hop] ??= { hop: n.hop, wallets: 0, value: 0, roles: new Set() }
      rows[n.hop].wallets++
      rows[n.hop].roles.add(n.role)
    }
    for (const t of d.transactions) {
      const h = byAddr[t.to_address]?.hop
      if (h == null || h < 0) continue
      rows[h].value += t.value_inr
    }
    return Object.values(rows).sort((a, b) => a.hop - b.hop)
  }, [d])
  const pool = d.pool_inr
  const toVasp = c.traced_to_vasp_inr
  const held = c.held_in_wallets_inr
  const other = Math.max(0, pool - toVasp - held)
  const parts = [
    { k: 'Reached exchanges (VASPs)', v: toVasp, color: '#2a78d6' },
    { k: 'Still held in suspect / layering wallets', v: held, color: '#eb6834' },
    { k: 'Fees, mixer loss & untraced', v: other, color: '#c3c2b7' },
  ]
  const total = parts.reduce((s, p) => s + p.v, 0) || 1
  const maxV = Math.max(...hops.map((h) => h.value), 1)

  return (
    <div className="space-y-5">
      <Card title="Where the money went" subtitle={`Of ${inr(pool)} that entered the reported wallet (complainant's ${inr(c.amount_lost_inr)} plus other inbound transfers)`}>
        <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-md">
          {parts.filter((p) => p.v > 0).map((p) => (
            <div key={p.k} title={`${p.k}: ${inr(p.v)}`} style={{ width: `${(100 * p.v) / total}%`, background: p.color }} className="first:rounded-l-md last:rounded-r-md" />
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {parts.map((p) => (
            <div key={p.k} className="flex items-start gap-2.5">
              <span className="mt-1 size-3 shrink-0 rounded-sm" style={{ background: p.color }} />
              <div>
                <div className="text-xs text-ink-2">{p.k}</div>
                <div className="font-bold text-navy-900">{inrShort(p.v)} <span className="text-xs font-medium text-ink-3">· {Math.round((100 * p.v) / total)}%</span></div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Hop-by-hop trace" subtitle="Value moving into each hop away from the reported wallet" pad={false}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-ink-2">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Hop</th>
              <th className="px-3 py-2.5 font-semibold">Wallets</th>
              <th className="px-3 py-2.5 font-semibold">What's here</th>
              <th className="w-[40%] px-3 py-2.5 font-semibold">Value moved in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {hops.map((h) => (
              <tr key={h.hop}>
                <td className="px-5 py-2.5 font-semibold text-navy-900">{h.hop === 0 ? '0 · reported' : h.hop}</td>
                <td className="tabular px-3 py-2.5">{h.wallets}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {[...h.roles].map((r) => (
                      <span key={r} className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-[11.5px] text-ink-2 ring-1 ring-line"><RoleGlyph role={r} size={10} />{ROLES[r].label}</span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${(100 * h.value) / maxV}%` }} /></div>
                    <span className="tabular w-20 text-right text-xs font-semibold">{inrShort(h.value)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- Transactions
export function TransactionsTab({ d }) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState('time')
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    let r = d.transactions.filter((t) => (!kind || t.kind === kind) && (!s || t.hash.includes(s) || t.from_address.toLowerCase().includes(s) || t.to_address.toLowerCase().includes(s)))
    r = [...r].sort(sort === 'value' ? (a, b) => b.value_inr - a.value_inr : (a, b) => a.timestamp.localeCompare(b.timestamp))
    return r
  }, [d, q, kind, sort])
  const PER = 20
  const view = rows.slice(page * PER, page * PER + PER)
  const kinds = [...new Set(d.transactions.map((t) => t.kind))]

  const exportCsv = () => {
    const cols = ['hash', 'network', 'block', 'timestamp', 'from_address', 'to_address', 'amount', 'token', 'value_inr', 'kind', 'hop', 'inferred']
    const csv = [cols.join(','), ...rows.map((t) => cols.map((k) => JSON.stringify(t[k] ?? '')).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${d.case.id}-transactions.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Card pad={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-56 flex-1">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input className={`${input} pl-8`} placeholder="Filter by hash or address" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} />
        </div>
        <select className={inputAuto} value={kind} onChange={(e) => { setKind(e.target.value); setPage(0) }}>
          <option value="">All types</option>
          {kinds.map((k) => <option key={k} value={k}>{TX_KIND[k]}</option>)}
        </select>
        <select className={inputAuto} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="time">Sort: time</option>
          <option value="value">Sort: value</option>
        </select>
        <button onClick={exportCsv} className={btn.secondary}><Download size={15} /> CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-ink-2">
            <tr>{['Time (IST)', 'Tx hash', 'From', 'To', 'Amount', 'Value', 'Type', 'Hop', 'Block'].map((h) => <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {view.map((t) => (
              <tr key={t.id + t.to_address} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-xs whitespace-nowrap text-ink-2">{dt(t.timestamp)}</td>
                <td className="px-3 py-2"><span className="inline-flex items-center font-mono text-[12px]">{short(t.hash, 8, 6)}<CopyBtn text={t.hash} size={11} /></span></td>
                <td className="px-3 py-2"><Address value={t.from_address} head={6} tail={4} copy={false} /></td>
                <td className="px-3 py-2"><Address value={t.to_address} head={6} tail={4} copy={false} /></td>
                <td className="tabular px-3 py-2 whitespace-nowrap">{token(t.amount, t.token)}</td>
                <td className="tabular px-3 py-2 whitespace-nowrap">{inrShort(t.value_inr)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11.5px] text-ink-2">{TX_KIND[t.kind]}</span>
                  {t.inferred && <span className="ml-1 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-700" title="Probabilistic link (mixer)">inferred</span>}
                </td>
                <td className="tabular px-3 py-2">{t.hop}</td>
                <td className="tabular px-3 py-2 text-xs text-ink-3">{num(t.block)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty>No transactions match the filter.</Empty>}
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-ink-2">
        <span>{rows.length} transactions</span>
        <div className="flex gap-1">
          <button className={btn.ghost} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="px-2 py-1">Page {page + 1} / {Math.max(1, Math.ceil(rows.length / PER))}</span>
          <button className={btn.ghost} disabled={(page + 1) * PER >= rows.length} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- Patterns
export function PatternsTab({ d }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {d.patterns.map((p, i) => (
        <Card key={i}>
          <div className="flex items-start justify-between gap-3">
            <div className="font-semibold text-navy-900">{p.type}</div>
            <RiskBadge level={p.severity === 'Low' ? 'Low' : p.severity} />
          </div>
          <p className="mt-2 text-sm text-ink-2">{p.description}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-3">Detection confidence <ConfidenceBar value={p.confidence} /></div>
          {p.type === 'Cross-case linkage' && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {d.case.linked_cases.map((id) => <Link key={id} to={`/cases/${id}`} className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-critical-ink hover:underline">{id}</Link>)}
            </div>
          )}
          <div className="mt-3 border-t border-line pt-2.5">
            <div className="mb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Evidence wallets ({p.wallets.length})</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {p.wallets.slice(0, 6).map((w) => <Address key={w} value={w} head={6} tail={4} copy={false} />)}
              {p.wallets.length > 6 && <span className="text-xs text-ink-3">+{p.wallets.length - 6} more</span>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Clusters
export function ClustersTab({ d }) {
  const byAddr = Object.fromEntries(d.nodes.map((n) => [n.address, n]))
  return (
    <div className="space-y-4">
      {d.clusters.map((c) => (
        <Card key={c.id} title={c.name} subtitle={`${c.id} · Heuristic: ${c.heuristic}`} action={<ConfidenceBar value={c.confidence} />}>
          {c.id.startsWith('CL-SYN') && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-critical-ink">
              <Link2 size={15} /> This cluster also appears in: {d.case.linked_cases.map((id, i) => <span key={id}>{i > 0 && ', '}<Link className="font-semibold underline" to={`/cases/${id}`}>{id}</Link></span>)}
            </div>
          )}
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {c.wallets.map((w) => (
              <div key={w} className="flex items-center gap-2">
                {byAddr[w] && <RoleGlyph role={byAddr[w].role} size={11} />}
                <Address value={w} head={8} tail={6} copy={false} />
                <span className="text-[11px] text-ink-3">{byAddr[w] ? inrShort(byAddr[w].in_inr) : ''}</span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Attribution
export function AttributionTab({ d, exchanges }) {
  if (!d.attributions.length) return <Card><Empty>No exchange deposit observed within the trace depth. Funds are still in layering wallets - watchlist monitoring is active.</Empty></Card>
  const ex = (id) => exchanges?.find((e) => e.id === id)
  return (
    <div className="space-y-4">
      {d.attributions.map((a, i) => {
        const e = ex(a.exchange_id)
        return (
          <Card key={a.exchange_id} className={i === 0 ? 'ring-2 ring-brand-500' : ''}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="grid size-11 place-items-center rounded-lg bg-brand-50 text-brand-600"><Building2 size={22} /></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-navy-900">{a.exchange}</span>
                    {i === 0 && <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[11px] font-bold text-white">NEAREST</span>}
                    {a.fiu_ind_registered
                      ? <span className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-good-ink"><BadgeCheck size={12} /> FIU-IND registered</span>
                      : <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-warn-ink"><Globe size={12} /> Not registered in India</span>}
                  </div>
                  <div className="mt-0.5 text-sm text-ink-2">{a.type} · {a.jurisdiction}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-ink-3">Attribution confidence</div>
                <ConfidenceBar value={a.confidence} className="mt-1 justify-end" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm md:grid-cols-5">
              <div><div className="text-xs text-ink-3">Hops from reported wallet</div><div className="text-lg font-bold">{a.hops}</div></div>
              <div><div className="text-xs text-ink-3">Amount received</div><div className="text-lg font-bold">{inrShort(a.amount_inr)}</div></div>
              <div><div className="text-xs text-ink-3">Complainant's share (pro-rata)</div><div className="text-lg font-bold">{inrShort(a.victim_attributable_inr)}</div></div>
              <div><div className="text-xs text-ink-3">Cooperation with LEA</div><div className="text-lg font-bold">{e?.cooperation ?? '-'}</div></div>
              <div><div className="text-xs text-ink-3">Avg. response time</div><div className="text-lg font-bold">{e?.avg_response_days ? `${e.avg_response_days} days` : 'No response'}</div></div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Deposit address(es) - request KYC for these</div>
                {a.deposit_addresses.map((w) => <div key={w}><Address value={w} full /></div>)}
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Evidence</div>
                <ul className="list-disc space-y-0.5 pl-4 text-sm text-ink-2">{a.evidence.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            </div>
            {i === 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <Link to={`/reports/${d.case.id}?tab=notice`} className={btn.primary}><Gavel size={15} /> Draft notice (Sec. 94 BNSS)</Link>
                <Link to={`/reports/${d.case.id}`} className={btn.secondary}><FileText size={15} /> Full investigation report</Link>
                {e && <span className="self-center text-xs text-ink-3">Compliance contact: {e.compliance_contact}</span>}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- Risk
export function RiskTab({ d }) {
  const f = d.risk.factors
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card title="Risk score" subtitle={d.risk.model}>
        <RiskGauge score={d.risk.score} />
        <p className="mt-4 text-xs text-ink-3">
          Bands: Low &lt; 40 · Medium 40-59 · High 60-79 · Critical ≥ 80. The score ranks which cases to act on first. It is not proof of guilt.
        </p>
      </Card>
      <Card className="lg:col-span-2" title="What drives the score" subtitle="How much each feature adds to the score (SHAP-style explanation)">
        <HBar label="Points" labels={f.map((x) => x.feature)} values={f.map((x) => x.contribution)} format={(v) => `+${v}`} />
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- Timeline & legal
export function TimelineTab({ d }) {
  const { notice, kyc_response: kyc } = d
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Card className="lg:col-span-3" title="Case timeline">
        <ol className="relative ml-2 border-l-2 border-line">
          {d.timeline.map((e, i) => (
            <li key={i} className="mb-5 ml-5 last:mb-0">
              <span className={`absolute -left-[7px] mt-1 size-3 rounded-full ring-4 ring-white ${i === d.timeline.length - 1 ? 'bg-brand-600' : 'bg-slate-300'}`} />
              <div className="text-xs text-ink-3">{dt(e.at)}</div>
              <div className="text-sm font-medium text-ink">{e.event}</div>
            </li>
          ))}
        </ol>
      </Card>
      <div className="space-y-5 lg:col-span-2">
        <Card title="Notice to exchange" action={<Gavel size={16} className="text-ink-3" />}>
          {notice ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-ink-3">Reference</dt><dd className="font-mono text-xs">{notice.ref}</dd>
              <dt className="text-ink-3">Exchange</dt><dd>{notice.exchange}</dd>
              <dt className="text-ink-3">Sent on</dt><dd>{dt(notice.sent_on)}</dd>
              <dt className="text-ink-3">Freeze requested</dt><dd className="font-semibold">{inr(notice.freeze_requested_inr)}</dd>
              <dt className="text-ink-3">Status</dt><dd><span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${notice.status === 'Responded' ? 'bg-green-50 text-good-ink' : 'bg-amber-50 text-warn-ink'}`}>{notice.status}</span></dd>
              <dt className="text-ink-3">Legal basis</dt><dd className="text-xs text-ink-2">{notice.legal_basis}</dd>
            </dl>
          ) : (
            <div className="text-sm text-ink-2">
              No notice sent yet.
              {d.attributions[0] && <Link to={`/reports/${d.case.id}?tab=notice`} className={`${btn.primary} mt-3 w-full`}><Gavel size={15} /> Draft notice now</Link>}
            </div>
          )}
        </Card>
        <Card title="KYC response from exchange" action={<UserRound size={16} className="text-ink-3" />}>
          {kyc ? (
            <>
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800"><Snowflake size={15} /> {inr(kyc.funds_frozen_inr)} frozen</div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-ink-3">Account holder</dt><dd className="font-mono">{kyc.account_holder}</dd>
                <dt className="text-ink-3">Mobile</dt><dd className="font-mono">{kyc.registered_mobile}</dd>
                <dt className="text-ink-3">Email</dt><dd className="font-mono text-xs">{kyc.email}</dd>
                <dt className="text-ink-3">PAN</dt><dd className="font-mono">{kyc.pan}</dd>
                <dt className="text-ink-3">KYC country</dt><dd>{kyc.kyc_country}</dd>
                <dt className="text-ink-3">Linked bank</dt><dd>{kyc.linked_bank}</dd>
                <dt className="text-ink-3">Login IPs</dt><dd className="font-mono text-xs">{kyc.login_ips.join(', ')}</dd>
                <dt className="text-ink-3">Received</dt><dd>{dt(kyc.received_on)}</dd>
              </dl>
              <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-ink-3"><ShieldAlert size={13} className="mt-0.5 shrink-0" /> Personal data is masked. Full details are visible only to the assigned investigating officer.</p>
            </>
          ) : (
            <div className="text-sm text-ink-2">{notice ? 'Awaiting response from the exchange.' : 'Available after the notice is answered.'}</div>
          )}
        </Card>
      </div>
    </div>
  )
}

