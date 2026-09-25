import { riskLevel } from '../lib/format'
import { RiskBadge } from './ui'

const BANDS = [
  [0, 40, 'var(--color-good)'],
  [40, 60, 'var(--color-warn)'],
  [60, 80, 'var(--color-serious)'],
  [80, 100, 'var(--color-critical)'],
]

function arc(cx, cy, r, a0, a1) {
  const p = (v) => {
    const a = Math.PI * (1 - v / 100)
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)]
  }
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`
}

export default function RiskGauge({ score, size = 220 }) {
  const cx = 110, cy = 105, r = 84
  const a = Math.PI * (1 - score / 100)
  const nx = cx + (r - 22) * Math.cos(a)
  const ny = cy - (r - 22) * Math.sin(a)
  const level = riskLevel(score)
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.6} viewBox="0 0 220 128" role="img" aria-label={`Risk score ${score} of 100, ${level}`}>
        {BANDS.map(([s, e, c]) => (
          <path key={s} d={arc(cx, cy, r, s + (s ? 0.8 : 0), e - (e < 100 ? 0.8 : 0))} stroke={c} strokeWidth="16" fill="none" opacity={score >= s ? 1 : 0.28} />
        ))}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#0b1f3a" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="7" fill="#0b1f3a" />
        <text x="22" y="124" fontSize="10" fill="#7b8699">0</text>
        <text x="190" y="124" fontSize="10" fill="#7b8699">100</text>
      </svg>
      <div className="-mt-1 text-4xl font-bold text-navy-900">{score}<span className="text-lg font-medium text-ink-3">/100</span></div>
      <RiskBadge level={level} className="mt-1.5" />
    </div>
  )
}
