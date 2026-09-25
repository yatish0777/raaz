import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, CheckCheck, Radar } from 'lucide-react'
import { listAlerts, listWatchlist, markAlertRead, markAllRead, subscribe } from '../lib/api'
import { ago, dateOnly, riskLevel, short, token } from '../lib/format'
import { Address, Card, Empty, NetworkBadge, PageHeader, RiskBadge, btn } from '../components/ui'

const TYPE_LABEL = {
  OUTBOUND_TRANSFER: 'Outbound transfer', EXCHANGE_DEPOSIT: 'Exchange deposit', NEW_INBOUND: 'New inbound',
  MIXER_INTERACTION: 'Mixer interaction', NOTICE_RESPONSE: 'Notice response', DORMANT_REACTIVATED: 'Dormant wallet active',
}

export default function Watchlist() {
  const [alerts, setAlerts] = useState([])
  const [list, setList] = useState([])
  const [filter, setFilter] = useState('unread')
  useEffect(() => {
    const load = () => Promise.all([listAlerts(), listWatchlist()]).then(([a, w]) => { setAlerts(a); setList(w) })
    load()
    return subscribe(load)
  }, [])
  const shown = alerts.filter((a) => filter === 'all' || !a.read)

  return (
    <>
      <PageHeader
        eyebrow="Real-time monitoring"
        title="Watchlist & alerts"
        subtitle="RAAZ checks watched wallets for new on-chain activity and alerts you when funds move"
        actions={<span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-sm font-medium text-good-ink"><span className="live-dot size-2 rounded-full bg-good" /> Monitoring {list.length} wallets</span>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card
          title="Alert feed"
          action={
            <div className="flex items-center gap-1">
              <div className="flex rounded-lg border border-line p-0.5 text-xs">
                {['unread', 'all'].map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-2.5 py-1 font-medium capitalize ${filter === f ? 'bg-navy-900 text-white' : 'text-ink-2'}`}>{f}</button>
                ))}
              </div>
              <button className={btn.ghost} onClick={markAllRead} title="Mark all as read"><CheckCheck size={15} /></button>
            </div>
          }
          pad={false}
        >
          <ul className="max-h-[720px] divide-y divide-line overflow-y-auto">
            {shown.map((a) => (
              <li key={a.id} className={`px-5 py-3.5 ${a.read ? '' : 'bg-brand-50/40'} ${a.live ? 'slide-in' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RiskBadge level={a.severity} />
                    <span className="text-xs font-medium text-ink-2">{TYPE_LABEL[a.type]}</span>
                    {a.live && <span className="rounded bg-brand-600 px-1.5 text-[10px] font-bold text-white">LIVE</span>}
                  </div>
                  <span className="text-[11px] whitespace-nowrap text-ink-3">{ago(a.at)}</span>
                </div>
                <div className="mt-1.5 text-sm text-ink">{a.message}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <NetworkBadge network={a.network} />
                  <Address value={a.address} head={6} tail={4} copy={false} />
                  {a.tx_hash && <span className="font-mono text-ink-3">tx {short(a.tx_hash, 6, 4)}</span>}
                  <Link to={`/cases/${a.case_id}`} className="font-semibold text-brand-700 hover:underline">{a.case_id}</Link>
                  {!a.read && <button onClick={() => markAlertRead(a.id)} className="ml-auto text-ink-3 hover:text-ink">Mark read</button>}
                </div>
              </li>
            ))}
          </ul>
          {!shown.length && <Empty><BellRing className="mx-auto mb-2 text-ink-3" /> No unread alerts.</Empty>}
        </Card>

        <Card title="Watched wallets" subtitle="Added by investigators or automatically when a case is opened" pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-ink-2">
                <tr>{['Wallet', 'Risk', 'Balance', 'Case', 'Added'].map((h) => <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((w) => (
                  <tr key={w.address}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5"><NetworkBadge network={w.network} /><Address value={w.address} head={6} tail={4} /></div>
                      <div className="mt-0.5 text-[11px] text-ink-3">{w.label} · {w.reason}</div>
                    </td>
                    <td className="px-3 py-2.5">{w.risk_score != null && <RiskBadge level={riskLevel(w.risk_score)} score={w.risk_score} />}</td>
                    <td className="tabular px-3 py-2.5 text-xs whitespace-nowrap">{w.balance != null ? token(w.balance, w.token) : '-'}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap"><Link to={`/cases/${w.case_id}`} className="font-semibold text-brand-700 hover:underline">{w.case_id}</Link></td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap text-ink-3">{dateOnly(w.added_on)}<div>{w.added_by}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-xs text-ink-3">
            <Radar size={14} /> Production: Celery beat checks each chain every block and pushes alerts to the browser over WebSocket.
          </div>
        </Card>
      </div>
    </>
  )
}
