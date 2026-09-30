import {
  BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip)

// Chart tokens (validated reference palette - slot 1 blue for single-series charts)
export const VIZ = {
  series1: '#2a78d6',
  series1Fill: 'rgba(42,120,214,0.10)',
  grid: '#e9ecf2',
  axis: '#c3c2b7',
  muted: '#7b8699',
  ink2: '#475569',
}

ChartJS.defaults.font.family = 'Inter, system-ui, sans-serif'
ChartJS.defaults.font.size = 11
ChartJS.defaults.color = VIZ.muted

const tooltip = {
  backgroundColor: '#0b1f3a',
  titleColor: '#fff',
  bodyColor: '#dbe7fe',
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
  titleFont: { weight: '600' },
}

/** Single-series line with crosshair-style index tooltip */
export function TrendLine({ labels, values, format = (v) => v, height = 220, label }) {
  return (
    <div style={{ height }}>
      <Line
        data={{
          labels,
          datasets: [{
            label, data: values, borderColor: VIZ.series1, backgroundColor: VIZ.series1Fill, fill: true,
            borderWidth: 2, tension: 0.3, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: VIZ.series1,
            pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
          }],
        }}
        options={{
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { tooltip: { ...tooltip, callbacks: { label: (c) => `${label}: ${format(c.parsed.y)}` } } },
          scales: {
            x: { grid: { display: false }, border: { color: VIZ.axis }, ticks: { maxTicksLimit: 7, maxRotation: 0 } },
            y: { grid: { color: VIZ.grid }, border: { display: false }, ticks: { maxTicksLimit: 5, callback: (v) => format(v) }, beginAtZero: true },
          },
        }}
      />
    </div>
  )
}

/** Single-series horizontal bar - identity carried by the category labels, not colour */
export function HBar({ labels, values, format = (v) => v, height, label, color = VIZ.series1, onClick }) {
  const h = height ?? Math.max(140, labels.length * 30 + 30)
  return (
    <div style={{ height: h }}>
      <Bar
        data={{ labels, datasets: [{ label, data: values, backgroundColor: color, hoverBackgroundColor: '#1c5cab', borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 }] }}
        options={{
          indexAxis: 'y',
          maintainAspectRatio: false,
          onClick: onClick ? (_, els) => els[0] && onClick(els[0].index) : undefined,
          onHover: onClick ? (e, els) => (e.native.target.style.cursor = els.length ? 'pointer' : 'default') : undefined,
          plugins: { tooltip: { ...tooltip, callbacks: { label: (c) => `${label}: ${format(c.parsed.x)}` } } },
          scales: {
            x: { grid: { color: VIZ.grid }, border: { display: false }, ticks: { maxTicksLimit: 5, callback: (v) => format(v) }, beginAtZero: true },
            y: { grid: { display: false }, border: { color: VIZ.axis }, ticks: { color: VIZ.ink2, font: { size: 11.5 } } },
          },
        }}
      />
    </div>
  )
}
