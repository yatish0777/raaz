import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Fingerprint, GitBranch, KeyRound, Lock, Radar, ShieldAlert, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Layout'
import { btn, input, Field } from '../components/ui'

const FEATURES = [
  { icon: GitBranch, t: 'Multi-hop fund tracing', d: 'Follow victim funds across wallets, bridges and mixers on BTC, Ethereum, TRON, BSC and Polygon.' },
  { icon: Building2, t: 'Nearest-VASP attribution', d: 'Identify the exchange that received the funds, with a confidence score and supporting evidence.' },
  { icon: Radar, t: 'Real-time watchlists', d: 'Get alerts the moment a suspect wallet moves funds or touches an exchange.' },
]

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [step, setStep] = useState(1)
  const [badge, setBadge] = useState('I4C-AN-2231')
  const [pw, setPw] = useState('')
  const [otp, setOtp] = useState('')
  const [err, setErr] = useState('')

  const submit = (e) => {
    e.preventDefault()
    setErr('')
    if (step === 1) {
      if (!badge.trim() || !pw) return setErr('Enter your officer ID and password.')
      return setStep(2)
    }
    if (!/^\d{6}$/.test(otp)) return setErr('Enter the 6-digit one-time password.')
    login(badge.trim())
    nav(loc.state?.from || '/', { replace: true })
  }

  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-12 text-white lg:flex">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden="true">
          <defs>
            <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
              <path d="M44 0H0v44" fill="none" stroke="#fff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <Logo size="lg" />
        <div className="relative max-w-lg">
          <h1 className="text-4xl leading-tight font-bold">
            From a victim's complaint to the <span className="text-brand-200">exchange that holds the money</span>, in minutes.
          </h1>
          <p className="mt-4 text-brand-100/80">
            RAAZ automates blockchain tracing for cyber-crime investigators. Enter a suspect wallet and get the fund-flow graph, detected laundering patterns, a risk score and a ready-to-send notice to the exchange.
          </p>
          <div className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <div key={f.t} className="flex gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-800 text-brand-200"><f.icon size={20} /></div>
                <div>
                  <div className="font-semibold">{f.t}</div>
                  <div className="text-sm text-brand-100/70">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-brand-200/60">Smart India Hackathon · Problem Statement SIH26183 · Prototype</div>
      </div>

      <div className="flex items-center justify-center bg-page p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo light={false} /></div>
          <div className="card p-8 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wider text-brand-600 uppercase">
              <Lock size={13} /> Secure sign-in
            </div>
            <h2 className="text-2xl font-bold text-navy-900">{step === 1 ? 'Investigator login' : 'Verify it’s you'}</h2>
            <p className="mt-1 text-sm text-ink-2">
              {step === 1 ? 'Use your department-issued credentials.' : 'Enter the one-time password sent to your registered device.'}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {step === 1 ? (
                <>
                  <Field label="Officer / Analyst ID">
                    <input className={input} value={badge} onChange={(e) => setBadge(e.target.value)} autoComplete="username" />
                  </Field>
                  <Field label="Password">
                    <input className={input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
                  </Field>
                </>
              ) : (
                <Field label="One-time password" hint="Demo: any 6 digits work.">
                  <input
                    className={`${input} text-center font-mono text-lg tracking-[0.5em]`}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoFocus
                    placeholder="000000"
                  />
                </Field>
              )}
              {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critical-ink">{err}</div>}
              <button className={`${btn.primary} w-full py-2.5`}>
                {step === 1 ? <><KeyRound size={16} /> Continue</> : <><Fingerprint size={16} /> Verify & sign in <ArrowRight size={16} /></>}
              </button>
              {step === 2 && (
                <button type="button" onClick={() => setStep(1)} className={`${btn.ghost} w-full`}>Back</button>
              )}
            </form>
            <p className="mt-5 text-center text-xs text-ink-3">Demo: any password, then any 6-digit OTP.</p>
          </div>
          <div className="mt-5 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-warn-ink">
            <ShieldAlert size={16} className="shrink-0" />
            This system is for authorised law-enforcement use only. Unauthorised access is an offence under the IT Act, 2000. All activity is logged and audited.
          </div>
        </div>
      </div>
    </div>
  )
}
