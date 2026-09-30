import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, CircleCheck, FileText, Gavel, LoaderCircle, PlugZap, Save, Search, TriangleAlert } from 'lucide-react'
import { listCases } from '../lib/api'
import { DEFAULT_OLLAMA, checkOllama, getOllamaConfig, setOllamaConfig } from '../lib/ollama'
import { inrShort } from '../lib/format'
import { Card, ErrorBox, Field, Loading, PageHeader, RiskBadge, StatusBadge, btn, input, useAsync } from '../components/ui'

function OllamaSettings() {
  const [cfg, setCfg] = useState(getOllamaConfig)
  const [st, setSt] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const test = async (c = cfg) => {
    setBusy(true)
    setSt(await checkOllama(c))
    setBusy(false)
  }
  useEffect(() => { test() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card title="AI report engine - Ollama" subtitle="A local LLM writes the report narrative. Case data never leaves your machine or department server." action={<Bot size={18} className="text-brand-600" />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ollama server URL"><input className={`${input} font-mono`} value={cfg.url} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} /></Field>
        <Field label="Model">
          {st?.ok && st.models.length ? (
            <select className={input} value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })}>
              {!st.models.includes(cfg.model) && <option value={cfg.model}>{cfg.model} (not pulled)</option>}
              {st.models.map((m) => <option key={m}>{m}</option>)}
            </select>
          ) : (
            <input className={`${input} font-mono`} value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })} />
          )}
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className={btn.secondary} onClick={() => test()} disabled={busy}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <PlugZap size={15} />} Test connection</button>
        <button className={btn.primary} onClick={() => { setOllamaConfig(cfg); setSaved(true); setTimeout(() => setSaved(false), 1500) }}><Save size={15} /> {saved ? 'Saved' : 'Save'}</button>
        <button className={btn.ghost} onClick={() => setCfg({ ...DEFAULT_OLLAMA })}>Reset</button>
        <div className="ml-auto text-sm">
          {st == null ? null : st.ok ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-good-ink"><CircleCheck size={16} /> Connected · {st.models.length} model(s) available{!st.hasModel && ` · "${cfg.model}" not pulled`}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-warn-ink"><TriangleAlert size={16} /> Not reachable ({st.error}). Reports use the offline template.</span>
          )}
        </div>
      </div>
      <details className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-ink-2">
        <summary className="cursor-pointer font-semibold text-ink">How to set up Ollama</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Install Ollama from ollama.com (Windows, macOS or Linux).</li>
          <li>Pull a model: <code className="rounded bg-white px-1.5 font-mono text-xs">ollama pull llama3.1:8b</code> (or <code className="rounded bg-white px-1.5 font-mono text-xs">qwen2.5:7b</code> / <code className="rounded bg-white px-1.5 font-mono text-xs">mistral</code>).</li>
          <li>Ollama listens on <code className="rounded bg-white px-1.5 font-mono text-xs">http://localhost:11434</code>. Requests from <code className="font-mono text-xs">localhost</code> pages are allowed by default.</li>
          <li>If RAAZ runs on another domain (e.g. Vercel), start Ollama with <code className="rounded bg-white px-1.5 font-mono text-xs">OLLAMA_ORIGINS=https://your-app.vercel.app</code>.</li>
        </ol>
        <p className="mt-2">In production, the FastAPI backend calls Ollama on a department GPU server, so browsers never connect to it directly.</p>
      </details>
    </Card>
  )
}

export default function Reports() {
  const { data, error, loading } = useAsync(listCases, [])
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    if (!data) return []
    const s = q.toLowerCase()
    return data.filter((c) => c.nearest_exchange && (!s || c.id.toLowerCase().includes(s) || c.nearest_exchange.toLowerCase().includes(s) || c.fraud_type.toLowerCase().includes(s)))
  }, [data, q])

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  return (
    <>
      <PageHeader eyebrow="Documentation" title="Reports & notices" subtitle="Investigation reports and Section 94 BNSS notices, drafted from the trace results" />
      <OllamaSettings />
      <Card className="mt-5" title="Cases ready for reporting" subtitle={`${rows.length} cases with an identified exchange`} pad={false}>
        <div className="border-b border-line p-3">
          <div className="relative max-w-md">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <input className={`${input} pl-8`} placeholder="Filter by case, exchange or fraud type" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-ink-2">
              <tr>{['Case', 'Fraud type', 'Nearest VASP', 'Traced to VASPs', 'Risk', 'Status', ''].map((h) => <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-semibold whitespace-nowrap"><Link to={`/cases/${c.id}`} className="text-brand-700 hover:underline">{c.id}</Link></td>
                  <td className="px-3 py-2.5">{c.fraud_type}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{c.nearest_exchange}</td>
                  <td className="tabular px-3 py-2.5">{inrShort(c.traced_to_vasp_inr)}</td>
                  <td className="px-3 py-2.5"><RiskBadge level={c.risk_level} score={c.risk_score} /></td>
                  <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Link to={`/reports/${c.id}`} className={btn.ghost}><FileText size={14} /> Report</Link>
                      <Link to={`/reports/${c.id}?tab=notice`} className={btn.ghost}><Gavel size={14} /> Notice</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
