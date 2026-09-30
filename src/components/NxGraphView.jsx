import { useMemo } from 'react'
import * as d3 from 'd3'
import { ROLES, inrShort, short } from '../lib/format'

// Renders a graph whose node positions were computed by NetworkX (scripts/networkx_graph.py).
// Positions arrive normalised to [0,1]; this component only draws them.

export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const OTHER = '#c3c7cf'
const SYMBOL = { circle: d3.symbolCircle, diamond: d3.symbolDiamond, triangle: d3.symbolTriangle, square: d3.symbolSquare }
const BASE_R = { suspect: 11, exchange_hot: 10, exchange_deposit: 9, mixer: 10, bridge: 10, consolidation: 9, victim: 9, inbound: 6, dust: 5, intermediary: 6 }
const LABELLED = new Set(['suspect', 'exchange_deposit', 'mixer', 'bridge', 'victim'])

export default function NxGraphView({ nx, layout = 'layers', sizeBy = 'role', colorBy = 'role', showPaths = true, selected, onSelect, height = 520 }) {
  const W = 1000
  const PAD = 48
  const g = useMemo(() => {
    const maxMetric = { betweenness: d3.max(nx.nodes, (n) => n.betweenness) || 1, pagerank: d3.max(nx.nodes, (n) => n.pagerank) || 1 }
    const r = (n) => (sizeBy === 'role' ? BASE_R[n.role] ?? 6 : 4 + 18 * Math.sqrt(n[sizeBy] / maxMetric[sizeBy]))
    const nodes = nx.nodes.map((n) => ({
      ...n,
      x: PAD + n.pos[layout][0] * (W - 2 * PAD),
      y: PAD + (1 - n.pos[layout][1]) * (height - 2 * PAD),
      r: r(n),
      color: colorBy === 'role' ? ROLES[n.role].color : CATEGORICAL[n.community] ?? OTHER,
    }))
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
    const width = d3.scaleSqrt().domain([0, d3.max(nx.edges, (e) => e.value_inr) || 1]).range([0.8, 7])
    const edges = nx.edges.map((e) => {
      const s = byId[e.source]
      const t = byId[e.target]
      const dx = t.x - s.x
      const dy = t.y - s.y
      const len = Math.hypot(dx, dy) || 1
      const ex = t.x - (dx / len) * (t.r + 3)
      const ey = t.y - (dy / len) * (t.r + 3)
      const mx = (s.x + ex) / 2 - dy * 0.06
      const my = (s.y + ey) / 2 + dx * 0.06
      return { ...e, d: `M${s.x},${s.y}Q${mx},${my} ${ex},${ey}`, w: width(e.value_inr) }
    })
    return { nodes, edges }
  }, [nx, layout, sizeBy, colorBy, height])

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label="NetworkX transaction graph">
      <defs>
        {[['nxa', '#c3cad6'], ['nxa-hl', '#1d4ed8']].map(([id, c]) => (
          <marker key={id} id={id} viewBox="0 -5 10 10" refX="9" refY="0" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,-5L10,0L0,5" fill={c} />
          </marker>
        ))}
      </defs>
      <g fill="none">
        {g.edges.map((e) => {
          const hl = showPaths && e.on_path
          return (
            <path key={e.source + e.target} d={e.d} stroke={hl ? '#1d4ed8' : '#c3cad6'} strokeWidth={e.w} strokeOpacity={hl ? 0.9 : 0.8}
              strokeDasharray={e.inferred ? '5 4' : undefined} markerEnd={`url(#${hl ? 'nxa-hl' : 'nxa'})`}>
              <title>{`${inrShort(e.value_inr)} · ${e.count} transfer(s)${e.flow_inr ? ` · max-flow ${inrShort(e.flow_inr)}` : ''}`}</title>
            </path>
          )
        })}
      </g>
      {g.nodes.map((n) => (
        <g key={n.id} transform={`translate(${n.x},${n.y})`} className="cursor-pointer" onClick={() => onSelect?.(n)}>
          {selected === n.id && <circle r={n.r + 5} fill="none" stroke="#1d4ed8" strokeWidth="2.5" />}
          <path d={d3.symbol(SYMBOL[ROLES[n.role].shape], Math.PI * n.r * n.r)()} fill={n.color} stroke="#fff" strokeWidth="1.8" />
          {LABELLED.has(n.role) && (
            <text y={n.r + 13} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0f172a" stroke="#fff" strokeWidth="3.5" paintOrder="stroke">
              {n.role === 'suspect' ? 'Reported wallet' : n.role === 'victim' ? 'Victim' : n.entity}
            </text>
          )}
          <title>{`${ROLES[n.role].label}${n.entity ? ` - ${n.entity}` : ''}\n${short(n.id, 10, 8)}\nbetweenness ${n.betweenness} · PageRank ${n.pagerank}\ncommunity ${n.community + 1} · in ${n.in_degree} / out ${n.out_degree}`}</title>
        </g>
      ))}
    </svg>
  )
}
