import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CircleAlert, CircleCheck, LoaderCircle, Play, Sparkles } from 'lucide-react'
import { createInvestigation, getSamples } from '../lib/api'
import { NETWORKS, detectNetwork } from '../lib/format'
import { Card, Field, NetworkBadge, PageHeader, btn, input, useAsync } from '../components/ui'

const FRAUD = [
  'Investment / Trading App Fraud', 'Task-based Part-time Job Fraud', 'Pig-butchering (Romance-Investment)',
  'Fake Crypto Exchange / Wallet', 'Digital Arrest Scam', 'Ponzi / MLM Token Scheme', 'Loan App Extortion',
]
const STATES = ['Maharashtra', 'Karnataka', 'Delhi', 'Telangana', 'Tamil Nadu', 'Uttar Pradesh', 'Rajasthan', 'Gujarat',
  'West Bengal', 'Punjab', 'Haryana', 'Kerala', 'Madhya Pradesh', 'Bihar', 'Odisha']

export default function NewInvestigation() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const samples = useAsync(getSamples, [])
  const [f, setF] = useState({
    address: params.get('address') || '', network: '', ncrp: '', victimName: '', amount: '', incidentDate: '',
    fraudType: FRAUD[0], state: 'Maharashtra', district: '', depth: 6, window: 90, bridges: true, mixers: true, watch: true, notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))

  const det = useMemo(() => detectNetwork(f.address), [f.address])
  const network = det ? (det.networks.includes(f.network) ? f.network : det.networks[0]) : ''

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!det) return setErr('Enter a valid Bitcoin, Ethereum/EVM or TRON wallet address.')
    setBusy(true)
    try {
      const r = await createInvestigation({ ...f, network, depth: Number(f.depth) })
      nav(`/analysis/${r.id}${r.existing ? '?existing=1' : ''}`)
    } catch (ex) {
      setErr(String(ex.message || ex))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Start a trace"
        title="New investigation"
        subtitle="Enter the wallet address the victim paid to. RAAZ traces where the money went and finds the exchange that received it."
      />
      <form onSubmit={submit} className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card title="1. Suspect wallet" subtitle="As reported by the complainant (from the NCRP complaint or payment screenshot)">
            <Field label="Wallet address" required>
              <input
                className={`${input} font-mono`}
                value={f.address}
                onChange={set('address')}
                placeholder="e.g. TQ4n…, 0x7a2f…, bc1q…"
                spellCheck={false}
                autoFocus
              />
            </Field>
            <div className="mt-2 min-h-6 text-xs">
              {f.address && (det ? (
                <span className="inline-flex items-center gap-1.5 text-good-ink"><CircleCheck size={14} /> Detected: {det.label}</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-critical-ink"><CircleAlert size={14} /> Address format not recognised</span>
              ))}
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Blockchain network" required hint={det?.family === 'EVM' ? 'EVM addresses are valid on several chains - pick the one in the complaint.' : 'Set automatically from the address.'}>
                <select className={input} value={network} onChange={set('network')} disabled={!det || det.networks.length === 1}>
                  {!det && <option value="">- enter address first -</option>}
                  {(det?.networks || []).map((n) => <option key={n} value={n}>{NETWORKS[n].name}</option>)}
                </select>
              </Field>
              <Field label="NCRP acknowledgement no.">
                <input className={input} value={f.ncrp} onChange={set('ncrp')} placeholder="14-digit ack. number" />
              </Field>
            </div>
            {samples.data && (
              <div className="mt-4 rounded-lg bg-brand-50 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-700"><Sparkles size={13} /> Try a sample wallet from the demo dataset</div>
                <div className="flex flex-wrap gap-2">
                  {samples.data.map((s) => (
                    <button
                      type="button"
                      key={s.address}
                      onClick={() => setF((x) => ({ ...x, address: s.address, network: s.network }))}
                      className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-white px-2 py-1 text-xs hover:border-brand-500"
                      title={s.label}
                    >
                      <NetworkBadge network={s.network} />
                      <span className="font-mono">{s.address.slice(0, 10)}…</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="2. Complaint details" subtitle="Used for the report and the notice to the exchange">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Complainant name"><input className={input} value={f.victimName} onChange={set('victimName')} /></Field>
              <Field label="Amount lost (₹)"><input className={input} type="number" min="0" value={f.amount} onChange={set('amount')} placeholder="e.g. 450000" /></Field>
              <Field label="Date of first payment"><input className={input} type="date" value={f.incidentDate} onChange={set('incidentDate')} max="2026-09-24" /></Field>
              <Field label="Fraud type">
                <select className={input} value={f.fraudType} onChange={set('fraudType')}>{FRAUD.map((x) => <option key={x}>{x}</option>)}</select>
              </Field>
              <Field label="State">
                <select className={input} value={f.state} onChange={set('state')}>{STATES.map((x) => <option key={x}>{x}</option>)}</select>
              </Field>
              <Field label="District"><input className={input} value={f.district} onChange={set('district')} /></Field>
            </div>
            <div className="mt-4">
              <Field label="Notes (optional)">
                <textarea className={`${input} min-h-20`} value={f.notes} onChange={set('notes')} placeholder="Brief description of how the fraud happened" />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="3. Trace settings">
            <Field label={`Maximum hop depth: ${f.depth}`} hint="How many wallet-to-wallet hops to follow from the reported wallet.">
              <input type="range" min="1" max="10" value={f.depth} onChange={set('depth')} className="w-full accent-brand-600" />
            </Field>
            <div className="mt-4">
              <Field label="Time window after first payment">
                <select className={input} value={f.window} onChange={set('window')}>
                  {[7, 30, 90, 180].map((d) => <option key={d} value={d}>{d} days</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-4 space-y-2.5 text-sm">
              {[
                ['bridges', 'Follow cross-chain bridges'],
                ['mixers', 'Follow mixer outputs (probabilistic)'],
                ['watch', 'Add suspect wallet to watchlist'],
              ].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2.5">
                  <input type="checkbox" checked={f[k]} onChange={set(k)} className="size-4 accent-brand-600" /> {l}
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold text-navy-900">What happens next</div>
            <ol className="mt-2 space-y-1.5 text-xs text-ink-2">
              <li>1. Fetch the wallet's transactions from blockchain explorers</li>
              <li>2. Follow the money hop by hop and build the graph</li>
              <li>3. Detect laundering patterns and group related wallets</li>
              <li>4. Match deposit addresses to known exchanges</li>
              <li>5. Score the risk and prepare the report</li>
            </ol>
            {err && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-critical-ink">{err}</div>}
            <button className={`${btn.primary} mt-4 w-full py-2.5`} disabled={busy || !f.address}>
              {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={16} />} Start automated trace
            </button>
          </Card>
        </div>
      </form>
    </>
  )
}
