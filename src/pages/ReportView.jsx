import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bot, CircleCheck, Copy, FileText, Gavel, LoaderCircle, Printer, RotateCcw, Sparkles, Square, TriangleAlert } from 'lucide-react'
import { getCase, listExchanges } from '../lib/api'
import { checkOllama, getOllamaConfig, streamGenerate } from '../lib/ollama'
import { SYSTEM_PROMPT, buildFacts, buildPrompt, templateNarrative } from '../lib/report'
import { NETWORKS, TX_KIND, copyText, dateOnly, dt, inr, nowSim, token } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { Card, ErrorBox, Loading, Tabs, btn, useAsync } from '../components/ui'

/** Minimal renderer for the LLM's "### heading / - bullet / paragraph" output */
function Narrative({ text, streaming }) {
  const blocks = []
  let list = null
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\*\*/g, '').trimEnd()
    if (/^#{1,4}\s/.test(line)) { list = null; blocks.push({ h: line.replace(/^#+\s*/, '') }) }
    else if (/^\s*([-*•]|\d+\.)\s+/.test(line)) {
      if (!list) { list = { li: [] }; blocks.push(list) }
      list.li.push(line.replace(/^\s*([-*•]|\d+\.)\s+/, ''))
    } else if (line.trim()) { list = null; blocks.push({ p: line.trim() }) }
  }
  return (
    <div className={streaming ? 'caret' : ''}>
      {blocks.map((b, i) => (b.h ? <h2 key={i}>{b.h}</h2> : b.li ? <ul key={i}>{b.li.map((x, j) => <li key={j}>{x}</li>)}</ul> : <p key={i}>{b.p}</p>))}
    </div>
  )
}

function useSha256(obj) {
  const [h, setH] = useState('')
  useEffect(() => {
    if (!obj || !crypto?.subtle) return
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(obj))).then((b) =>
      setH([...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')))
  }, [obj])
  return h
}

export default function ReportView() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'notice' ? 'notice' : 'report'
  const { user } = useAuth()
  const { data, error, loading } = useAsync(() => Promise.all([getCase(id), listExchanges()]), [id])
  const d = data?.[0]
  const exchanges = data?.[1]
  const facts = useMemo(() => (d ? buildFacts(d, exchanges) : null), [d, exchanges])
  const [text, setText] = useState('')
  const [mode, setMode] = useState('template') // template | ollama
  const [status, setStatus] = useState('idle') // idle | streaming | done | error
  const [err, setErr] = useState('')
  const [oll, setOll] = useState(null)
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef(null)
  const noticeRef = useRef(null)
  const evidenceHash = useSha256(d?.transactions)
  const cfg = getOllamaConfig()

  useEffect(() => { if (facts) setText(templateNarrative(facts)) }, [facts])
  useEffect(() => { checkOllama().then(setOll) }, [])
  useEffect(() => () => abortRef.current?.abort(), [])

  const generate = async () => {
    setErr('')
    const st = await checkOllama()
    setOll(st)
    if (!st.ok) {
      setErr(`Ollama is not reachable at ${cfg.url} (${st.error}). Showing the offline template draft instead.`)
      setMode('template')
      setText(templateNarrative(facts))
      return
    }
    const ac = new AbortController()
    abortRef.current = ac
    setMode('ollama')
    setStatus('streaming')
    setText('')
    try {
      for await (const chunk of streamGenerate({ prompt: buildPrompt(facts), system: SYSTEM_PROMPT, signal: ac.signal })) {
        setText((t) => t + chunk)
      }
      setStatus('done')
    } catch (e) {
      if (e.name === 'AbortError') { setStatus('done'); return }
      setErr(String(e.message || e))
      setStatus('error')
    }
  }

  if (loading) return <Loading label="Preparing report…" />
  if (error) return <ErrorBox error={error} />
  const c = d.case
  const n0 = d.attributions[0]
  const ex = exchanges.find((e) => e.id === n0?.exchange_id)
  const today = dateOnly(nowSim().toISOString())
  const keyTx = d.transactions.filter((t) => ['victim_payment', 'exchange_deposit'].includes(t.kind))
  const noticeRef_ = d.notice?.ref || `RAAZ/NTC/2026/${c.id.slice(-4)}`
  const depositTx = n0 ? d.transactions.filter((t) => t.kind === 'exchange_deposit' && n0.deposit_addresses.includes(t.to_address)) : []

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={`/cases/${c.id}`} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"><ArrowLeft size={15} /> Back to {c.id}</Link>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">{tab === 'notice' ? 'Notice to exchange' : 'Investigation report'}</h1>
        </div>
        <div className="flex gap-2">
          {tab === 'notice' && n0 && (
            <button className={btn.secondary} onClick={async () => { if (await copyText(noticeRef.current?.innerText || '')) { setCopied(true); setTimeout(() => setCopied(false), 1500) } }}>
              <Copy size={15} /> {copied ? 'Copied' : 'Copy text'}
            </button>
          )}
          <button className={btn.primary} onClick={() => window.print()}><Printer size={15} /> Print / Save PDF</button>
        </div>
      </div>
      <div className="no-print mb-5">
        <Tabs
          tabs={[{ id: 'report', label: 'Investigation report', icon: FileText }, { id: 'notice', label: 'Notice (Sec. 94 BNSS)', icon: Gavel }]}
          value={tab}
          onChange={(t) => setParams(t === 'notice' ? { tab: 'notice' } : {}, { replace: true })}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[300px_1fr]">
        {/* controls */}
        <div className="no-print space-y-5 xl:sticky xl:top-0">
          {tab === 'report' ? (
            <Card title="AI narrative" action={<Bot size={17} className="text-brand-600" />}>
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${oll == null ? 'bg-slate-400' : oll.ok ? 'bg-good' : 'bg-warn'}`} />
                  {oll == null ? 'Checking Ollama…' : oll.ok ? <>Ollama connected · <span className="font-mono text-xs">{cfg.model}</span></> : 'Ollama offline'}
                </div>
                <div className="mt-2 text-xs text-ink-3">
                  Now showing: <b className="text-ink-2">{mode === 'ollama' ? `AI draft (${cfg.model})` : 'Offline template draft'}</b>
                </div>
              </div>
              {status === 'streaming' ? (
                <button className={`${btn.secondary} mt-4 w-full`} onClick={() => abortRef.current?.abort()}><Square size={14} /> Stop</button>
              ) : (
                <button className={`${btn.primary} mt-4 w-full`} onClick={generate}><Sparkles size={15} /> {mode === 'ollama' ? 'Regenerate with Ollama' : 'Write with Ollama'}</button>
              )}
              {mode === 'ollama' && status !== 'streaming' && (
                <button className={`${btn.ghost} mt-2 w-full`} onClick={() => { setMode('template'); setText(templateNarrative(facts)) }}><RotateCcw size={14} /> Use template instead</button>
              )}
              {status === 'streaming' && <div className="mt-3 flex items-center gap-2 text-xs text-brand-700"><LoaderCircle size={14} className="animate-spin" /> Writing… (runs locally)</div>}
              {err && <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-warn-ink"><TriangleAlert size={14} className="shrink-0" /> {err}</div>}
              <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
                The model gets only the structured facts of this case and writes the narrative. The tables in the report come straight from the trace, not from the model. <Link to="/reports" className="text-brand-700">Ollama settings</Link>
              </p>
            </Card>
          ) : (
            <Card title="Notice details">
              {n0 ? (
                <div className="space-y-2 text-sm">
                  <div><div className="text-xs text-ink-3">Addressed to</div><div className="font-semibold">{n0.exchange}</div><div className="text-xs text-ink-3">{ex?.compliance_contact}</div></div>
                  <div><div className="text-xs text-ink-3">Deposit addresses</div><div className="font-semibold">{n0.deposit_addresses.length}</div></div>
                  <div><div className="text-xs text-ink-3">Freeze requested</div><div className="font-semibold">{inr(n0.victim_attributable_inr)}</div></div>
                  <div><div className="text-xs text-ink-3">Typical response time</div><div className="font-semibold">{ex?.avg_response_days ? `${ex.avg_response_days} days` : 'No response on record'}</div></div>
                  {d.notice ? (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 p-2.5 text-xs font-medium text-good-ink"><CircleCheck size={15} /> Sent on {dateOnly(d.notice.sent_on)} · {d.notice.status}</div>
                  ) : (
                    <button className={`${btn.primary} mt-3 w-full`} disabled={sent} onClick={() => setSent(true)}>
                      <Gavel size={15} /> {sent ? 'Marked as sent (demo)' : 'Mark as sent'}
                    </button>
                  )}
                  <p className="border-t border-line pt-3 text-xs text-ink-3">This is a draft. The Investigating Officer must check it, sign it and send it through official channels.</p>
                </div>
              ) : (
                <div className="text-sm text-ink-2">No exchange identified yet, so there is nobody to send a notice to.</div>
              )}
            </Card>
          )}
        </div>

        {/* document */}
        <article className="doc doc-sheet card mx-auto w-full max-w-[860px] px-10 py-9 shadow-sm">
          {tab === 'report' ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b-2 border-navy-900 pb-3">
                <div>
                  <div className="text-[11px] font-bold tracking-[0.2em] text-critical-ink">CONFIDENTIAL · FOR LAW-ENFORCEMENT USE</div>
                  <div className="mt-1 text-xl font-bold text-navy-900">Crypto Fund-Trace Investigation Report</div>
                  <div className="text-xs text-ink-2">Generated by RAAZ - Automated Anti-Fraud Analysis (prototype, demo data)</div>
                </div>
                <div className="text-right text-xs text-ink-2">
                  <div className="font-mono font-semibold text-ink">{c.id}</div>
                  <div>Date: {today}</div>
                  <div>Prepared by: {user.name}</div>
                </div>
              </div>

              <h2>1. Case particulars</h2>
              <table>
                <tbody>
                  <tr><th>NCRP acknowledgement</th><td>{c.ncrp_ack}</td><th>Reported on</th><td>{dateOnly(c.reported_at)}</td></tr>
                  <tr><th>Complainant</th><td>{c.victim.name}</td><th>Location</th><td>{c.district}, {c.state}</td></tr>
                  <tr><th>Fraud type</th><td>{c.fraud_type}</td><th>Investigating officer</th><td>{c.investigator}</td></tr>
                  <tr><th>Amount lost</th><td>{inr(c.amount_lost_inr)} ({token(c.amount_lost_token, c.token)})</td><th>Network</th><td>{NETWORKS[c.network].name}</td></tr>
                  <tr><th>Reported wallet</th><td colSpan={3} className="font-mono text-[11.5px] break-all">{c.reported_wallet}</td></tr>
                </tbody>
              </table>

              <Narrative text={text} streaming={status === 'streaming'} />

              <h2>Exchange (VASP) attribution</h2>
              {d.attributions.length ? (
                <table>
                  <thead><tr><th>Exchange</th><th>Jurisdiction</th><th>Hops</th><th>Received</th><th>Complainant share</th><th>Confidence</th></tr></thead>
                  <tbody>
                    {d.attributions.map((a) => (
                      <tr key={a.exchange_id}>
                        <td><b>{a.exchange}</b><div className="text-[11px] text-ink-3">{a.fiu_ind_registered ? 'FIU-IND registered' : 'Not registered in India'}</div></td>
                        <td>{a.jurisdiction}</td><td>{a.hops}</td><td>{inr(a.amount_inr)}</td><td>{inr(a.victim_attributable_inr)}</td><td>{Math.round(a.confidence * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p>No exchange deposit observed within the trace depth.</p>}

              <h2>Detected laundering patterns</h2>
              <table>
                <thead><tr><th>Pattern</th><th>Severity</th><th>Observation</th></tr></thead>
                <tbody>{d.patterns.map((p, i) => <tr key={i}><td className="whitespace-nowrap">{p.type}</td><td>{p.severity}</td><td>{p.description}</td></tr>)}</tbody>
              </table>

              <h2>Risk assessment</h2>
              <p>Risk score <b>{d.risk.score}/100 ({d.risk.level})</b> - {d.risk.model}. Main factors: {d.risk.factors.slice(0, 4).map((f) => `${f.feature} (+${f.contribution})`).join('; ')}.</p>

              <h2>Key transactions</h2>
              <table>
                <thead><tr><th>Time (IST)</th><th>Type</th><th>Amount</th><th>Value</th><th>Transaction hash</th></tr></thead>
                <tbody>
                  {keyTx.map((t) => (
                    <tr key={t.id + t.to_address}>
                      <td className="whitespace-nowrap">{dt(t.timestamp)}</td><td>{TX_KIND[t.kind]}</td><td className="whitespace-nowrap">{token(t.amount, t.token)}</td>
                      <td className="whitespace-nowrap">{inr(t.value_inr)}</td><td className="font-mono text-[10.5px] break-all">{t.hash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2>Evidence integrity</h2>
              <p>The on-chain data for this case ({d.transactions.length} transactions, {d.nodes.length} wallets) was exported as an evidence bundle. SHA-256 hash of the bundle:</p>
              <p className="font-mono text-[11px] break-all">{evidenceHash || 'computing…'}</p>
              <p className="text-[12px] text-ink-3">Anyone can re-compute this hash from the exported bundle to confirm nothing was changed. It supports the certificate for electronic records under Section 63 of the Bharatiya Sakshya Adhiniyam, 2023.</p>
            </>
          ) : n0 ? (
            <div ref={noticeRef}>
              <div className="text-center">
                <div className="text-[11px] font-bold tracking-[0.2em] text-warn-ink">DRAFT - VERIFY BEFORE ISSUE</div>
                <div className="mt-2 text-base font-bold text-navy-900 uppercase">Notice under Section 94 of the Bharatiya Nagarik Suraksha Sanhita, 2023</div>
                <div className="text-xs text-ink-2">(Summons to produce documents or other things) with request for freezing under Section 106 BNSS</div>
              </div>
              <div className="mt-5 flex justify-between text-[13px]">
                <div>Ref. No.: <b className="font-mono">{noticeRef_}</b></div>
                <div>Date: {today}</div>
              </div>
              <p className="mt-4">To,<br />The Nodal / Compliance Officer,<br /><b>{n0.exchange}</b> ({n0.jurisdiction})<br />{ex?.compliance_contact}</p>
              <p><b>Subject:</b> Production of KYC and transaction records, and freezing of account(s) linked to the deposit address(es) below - Case {c.id} / NCRP Ack. {c.ncrp_ack}.</p>
              <p>Sir / Madam,</p>
              <p>
                This office is investigating a complaint of {c.fraud_type.toLowerCase()} registered on the National Cyber Crime Reporting Portal (Ack. No. {c.ncrp_ack}) from {c.district}, {c.state}.
                The complainant lost {inr(c.amount_lost_inr)}, which was transferred as {c.token} on the {NETWORKS[c.network].name} network. Blockchain analysis shows that {inr(n0.amount_inr)} of the traced funds
                was deposited to the following address(es), which your platform controls:
              </p>
              <table>
                <thead><tr><th>#</th><th>Deposit address</th><th>Network</th><th>Deposit transaction(s)</th></tr></thead>
                <tbody>
                  {n0.deposit_addresses.map((a, i) => (
                    <tr key={a}>
                      <td>{i + 1}</td>
                      <td className="font-mono text-[11px] break-all">{a}</td>
                      <td>{NETWORKS[d.nodes.find((n) => n.address === a)?.network]?.name}</td>
                      <td className="font-mono text-[10px] break-all">
                        {depositTx.filter((t) => t.to_address === a).map((t) => <Fragment key={t.id}>{t.hash} ({token(t.amount, t.token)}, {dt(t.timestamp)})<br /></Fragment>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>Under Section 94 of the BNSS, 2023, you are requested to provide the following within <b>3 days</b> of receiving this notice:</p>
              <ol>
                <li>KYC documents and registered mobile number / email of the account holder(s) linked to the above address(es);</li>
                <li>Login IP addresses, device identifiers and session logs from account creation to date;</li>
                <li>The full deposit, trade and withdrawal history, including linked bank accounts, UPI IDs and withdrawal addresses;</li>
                <li>Details of any P2P counterparties who traded with the account.</li>
              </ol>
              <p>
                You are also requested to <b>immediately freeze debits</b> from the said account(s), up to <b>{inr(n0.victim_attributable_inr)}</b> (the complainant's pro-rata share of the traced funds), and to preserve all related records until further orders.
              </p>
              <p>Please treat this notice as confidential and do not inform the account holder.</p>
              <div className="mt-8 flex justify-end">
                <div className="text-right text-[13px]">
                  <div className="h-10" />
                  <div className="font-semibold">({c.investigator})</div>
                  <div>Investigating Officer</div>
                  <div className="text-ink-2">Case {c.id}</div>
                </div>
              </div>
            </div>
          ) : (
            <p>No exchange has been identified for this case yet.</p>
          )}
        </article>
      </div>
    </>
  )
}
