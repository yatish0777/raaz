import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Radar, Wallet } from 'lucide-react'
import { addToWatchlist, getWallet, listWatchlist } from '../lib/api'
import { NETWORKS, ROLES, TX_KIND, dt, inrShort, riskLevel, short, token } from '../lib/format'
import { Address, Card, CopyBtn, Empty, ErrorBox, Loading, NetworkBadge, RiskBadge, btn, useAsync } from '../components/ui'
import { RoleGlyph } from '../components/TxGraph'

export default function WalletProfile() {
  const { address } = useParams()
  const { data, error, loading } = useAsync(() => Promise.all([getWallet(address), listWatchlist()]), [address])
  const [added, setAdded] = useState(false)

  const cps = useMemo(() => {
    if (!data?.[0]) return []
    const me = data[0].wallet.address
    const m = {}
    for (const t of data[0].transactions) {
      const out = t.from_address === me
      const other = out ? t.to_address : t.from_address
      m[other] ??= { address: other, sent: 0, received: 0, n: 0 }
      m[other][out ? 'sent' : 'received'] += t.value_inr
      m[other].n++
    }
    return Object.values(m).sort((a, b) => b.sent + b.received - (a.sent + a.received)).slice(0, 12)
  }, [data])

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  if (!data[0]) {
    return (
      <Card>
        <Empty>
          This wallet is not in any RAAZ case yet.
          <div className="mt-3"><Link className={btn.primary} to={`/investigate?address=${encodeURIComponent(address)}`}>Start an investigation on it</Link></div>
        </Empty>
      </Card>
    )
  }
  const { wallet: w, transactions: txs } = data[0]
  const watched = added || data[1].some((x) => x.address === w.address)
  const level = riskLevel(w.risk_score)
  const role = ROLES[w.role]

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-wider text-brand-600 uppercase">Wallet profile</div>
          <div className="mt-1 flex items-center gap-2">
            <Wallet size={20} className="shrink-0 text-navy-900" />
            <h1 className="font-mono text-lg font-semibold break-all text-navy-900">{w.address}</h1>
            <CopyBtn text={w.address} size={15} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <NetworkBadge network={w.network} long />
            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium"><RoleGlyph role={w.role} size={11} /> {role.label}</span>
            {w.entity && <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{w.entity}</span>}
            <RiskBadge level={level} score={w.risk_score} />
            {w.cluster_id && <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs">{w.cluster_id}</span>}
          </div>
        </div>
        {!['victim', 'exchange_hot', 'mixer', 'bridge'].includes(w.role) && (
          <button
            className={watched ? btn.secondary : btn.primary}
            disabled={watched}
            onClick={async () => {
              await addToWatchlist({ address: w.address, network: w.network, case_id: w.cases[0], label: role.label, reason: 'Added from wallet profile', risk_score: w.risk_score, balance: w.balance, token: w.token })
              setAdded(true)
            }}
          >
            <Radar size={15} /> {watched ? 'On watchlist' : 'Add to watchlist'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['Total received', inrShort(w.in_inr)],
          ['Total sent', inrShort(w.out_inr)],
          ['Balance (traced)', w.balance != null ? token(w.balance, w.token) : '-'],
          ['Transactions', w.tx_count],
          ['First seen', dt(w.first_seen)],
          ['Last seen', dt(w.last_seen)],
        ].map(([k, v]) => (
          <div key={k} className="card px-4 py-3">
            <div className="text-xs text-ink-3">{k}</div>
            <div className="mt-0.5 font-bold text-navy-900">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Label & attribution">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-xs text-ink-3">Label</dt><dd>{w.label}</dd></div>
            <div><dt className="text-xs text-ink-3">Network</dt><dd>{NETWORKS[w.network].name}</dd></div>
            <div><dt className="text-xs text-ink-3">Entity</dt><dd>{w.entity || 'Unattributed (private wallet)'}</dd></div>
            <div>
              <dt className="text-xs text-ink-3">Appears in {w.cases.length} case(s)</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {w.cases.map((c) => <Link key={c} to={`/cases/${c}`} className="rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 hover:underline">{c}</Link>)}
              </dd>
            </div>
          </dl>
          {w.cases.length > 1 && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-critical-ink">This wallet links several complaints. It is likely controlled by the same operator.</p>}
        </Card>
        <Card className="lg:col-span-2" title="Top counterparties" pad={false}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-ink-2">
              <tr><th className="px-4 py-2 font-semibold">Wallet</th><th className="px-3 py-2 font-semibold">Received from</th><th className="px-3 py-2 font-semibold">Sent to</th><th className="px-3 py-2 font-semibold">Txs</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cps.map((c) => (
                <tr key={c.address}>
                  <td className="px-4 py-2"><Address value={c.address} head={8} tail={6} /></td>
                  <td className="tabular px-3 py-2">{c.received ? inrShort(c.received) : '-'}</td>
                  <td className="tabular px-3 py-2">{c.sent ? inrShort(c.sent) : '-'}</td>
                  <td className="tabular px-3 py-2">{c.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="mt-5" title="Transactions" subtitle={`${txs.length} in RAAZ cases`} pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-ink-2">
              <tr>{['', 'Time (IST)', 'Tx hash', 'Counterparty', 'Amount', 'Value', 'Type', 'Case'].map((h) => <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {txs.slice(0, 100).map((t) => {
                const out = t.from_address === w.address
                return (
                  <tr key={t.id + t.to_address + t.case_id}>
                    <td className="pl-3">{out ? <ArrowUpRight size={15} className="text-serious-ink" aria-label="Outgoing" /> : <ArrowDownLeft size={15} className="text-good-ink" aria-label="Incoming" />}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-ink-2">{dt(t.timestamp)}</td>
                    <td className="px-3 py-2 font-mono text-[12px]">{short(t.hash, 8, 6)}</td>
                    <td className="px-3 py-2"><Address value={out ? t.to_address : t.from_address} head={6} tail={4} copy={false} /></td>
                    <td className="tabular px-3 py-2 whitespace-nowrap">{out ? '−' : '+'}{token(t.amount, t.token)}</td>
                    <td className="tabular px-3 py-2">{inrShort(t.value_inr)}</td>
                    <td className="px-3 py-2"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11.5px] text-ink-2">{TX_KIND[t.kind]}</span></td>
                    <td className="px-3 py-2 text-xs"><Link to={`/cases/${t.case_id}`} className="text-brand-700 hover:underline">{t.case_id}</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {txs.length > 100 && <div className="border-t border-line px-4 py-2 text-xs text-ink-3">Showing latest 100 of {txs.length}</div>}
        </div>
      </Card>
    </>
  )
}
