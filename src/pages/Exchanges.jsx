import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Globe, Mail, OctagonAlert, Search } from 'lucide-react'
import { listCases, listExchanges } from '../lib/api'
import { inrShort } from '../lib/format'
import { Address, Card, ErrorBox, Loading, NetworkBadge, PageHeader, StatusBadge, input, inputAuto, useAsync } from '../components/ui'
import { HBar } from '../components/charts'

const COOP = {
  High: ['bg-green-50 text-good-ink ring-green-200', CircleCheck],
  Medium: ['bg-amber-50 text-warn-ink ring-amber-200', CircleAlert],
  Low: ['bg-red-50 text-critical-ink ring-red-200', OctagonAlert],
}
function CoopBadge({ level }) {
  const [cls, Icon] = COOP[level]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}><Icon size={12} /> {level}</span>
}

export default function Exchanges() {
  const { data, error, loading } = useAsync(() => Promise.all([listExchanges(), listCases()]), [])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [only, setOnly] = useState('')

  const rows = useMemo(() => {
    if (!data) return []
    const s = q.toLowerCase()
    return data[0]
      .filter((e) => (!s || e.name.toLowerCase().includes(s) || e.jurisdiction.toLowerCase().includes(s)) &&
        (!only || (only === 'in' ? e.fiu_ind_registered : !e.fiu_ind_registered)))
      .sort((a, b) => b.total_inr_received - a.total_inr_received)
  }, [data, q, only])

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  const [exchanges, cases] = data
  const ranked = [...exchanges].sort((a, b) => b.cases_linked - a.cases_linked)

  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="VASP directory"
        subtitle="Exchanges and OTC/P2P desks seen receiving traced fraud funds, with how quickly they respond to law enforcement"
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Cases linked to each exchange" subtitle="Number of RAAZ cases where funds reached the exchange">
          <HBar label="Cases" labels={ranked.map((e) => e.name)} values={ranked.map((e) => e.cases_linked)} />
        </Card>
        <Card title="Notice response rate" subtitle="Notices answered ÷ notices sent" pad={false}>
          <ul className="divide-y divide-line">
            {[...exchanges].filter((e) => e.notices_sent).sort((a, b) => b.notices_responded / b.notices_sent - a.notices_responded / a.notices_sent).map((e) => {
              const r = e.notices_responded / e.notices_sent
              return (
                <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="w-44 truncate">{e.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${r * 100}%` }} /></div>
                  <span className="tabular w-24 text-right text-xs text-ink-2"><b className="text-ink">{e.notices_responded}</b> / {e.notices_sent} answered</span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <Card className="mt-5" pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-60 flex-1">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <input className={`${input} pl-8`} placeholder="Search exchange or jurisdiction" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={inputAuto} value={only} onChange={(e) => setOnly(e.target.value)}>
            <option value="">All registrations</option>
            <option value="in">FIU-IND registered</option>
            <option value="off">Not registered in India</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-ink-2">
              <tr>{['', 'Exchange', 'Type / jurisdiction', 'FIU-IND', 'KYC', 'LEA cooperation', 'Avg. response', 'Cases', 'Received', 'Notices'].map((h) => <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => {
                const isOpen = open === e.id
                const linked = cases.filter((c) => c.nearest_exchange_id === e.id)
                return (
                  <Fragment key={e.id}>
                    <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(isOpen ? null : e.id)}>
                      <td className="pl-3 text-ink-3">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                      <td className="px-3 py-2.5 font-semibold whitespace-nowrap text-navy-900">{e.name}</td>
                      <td className="px-3 py-2.5"><div>{e.type}</div><div className="text-xs text-ink-3">{e.jurisdiction}</div></td>
                      <td className="px-3 py-2.5">
                        {e.fiu_ind_registered
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-good-ink"><BadgeCheck size={14} /> Yes</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-semibold text-warn-ink"><Globe size={14} /> No</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{e.kyc_level}</td>
                      <td className="px-3 py-2.5"><CoopBadge level={e.cooperation} /></td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{e.avg_response_days ? `${e.avg_response_days} days` : <span className="text-critical-ink">No response</span>}</td>
                      <td className="tabular px-3 py-2.5">{e.cases_linked}</td>
                      <td className="tabular px-3 py-2.5 whitespace-nowrap">{inrShort(e.total_inr_received)}</td>
                      <td className="tabular px-3 py-2.5 whitespace-nowrap">{e.notices_responded}/{e.notices_sent}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50/70">
                        <td />
                        <td colSpan={9} className="px-3 pt-2 pb-4">
                          <div className="grid gap-5 md:grid-cols-3">
                            <div>
                              <div className="mb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Known hot wallets</div>
                              {e.hot_wallets.map((h) => (
                                <div key={h.address} className="flex items-center gap-2 py-0.5"><NetworkBadge network={h.network} /><Address value={h.address} head={8} tail={6} /></div>
                              ))}
                            </div>
                            <div>
                              <div className="mb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Compliance contact for LEA requests</div>
                              <div className="flex items-center gap-1.5 text-sm"><Mail size={14} className="text-ink-3" /> {e.compliance_contact}</div>
                              <div className="mt-2 text-xs text-ink-3">{e.known_deposit_addresses} deposit addresses seen in RAAZ cases · supports {e.networks.join(', ')}</div>
                            </div>
                            <div>
                              <div className="mb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Cases where this is the nearest VASP ({linked.length})</div>
                              <div className="space-y-1">
                                {linked.slice(0, 6).map((c) => (
                                  <Link key={c.id} to={`/cases/${c.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
                                    <span className="font-semibold text-brand-700">{c.id}</span><StatusBadge status={c.status} />
                                  </Link>
                                ))}
                                {linked.length > 6 && <Link to={`/cases?q=${encodeURIComponent(e.name)}`} className="text-xs text-brand-700">+{linked.length - 6} more</Link>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
