import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { ROLES, inrShort, short } from '../lib/format'

const COL = 135
const BASE_R = { suspect: 15, exchange_hot: 14, exchange_deposit: 12, mixer: 13, bridge: 13, consolidation: 12, victim: 12, inbound: 8, dust: 6, intermediary: 7 }
const SYMBOL = { circle: d3.symbolCircle, diamond: d3.symbolDiamond, triangle: d3.symbolTriangle, square: d3.symbolSquare }
const LABELLED = new Set(['suspect', 'victim', 'exchange_deposit', 'mixer', 'bridge', 'consolidation'])
const EDGE = '#c3cad6'
const EDGE_HL = '#1d4ed8'

const radius = (d) => BASE_R[d.role] ?? 7
const area = (d) => {
  const r = radius(d)
  const shape = ROLES[d.role]?.shape
  return shape === 'circle' ? Math.PI * r * r : shape === 'triangle' ? r * r * 2.6 : r * r * 3.2
}
const labelFor = (d) => {
  if (d.role === 'suspect') return 'Reported wallet'
  if (d.role === 'victim') return 'Victim'
  if (d.role === 'consolidation') return 'Consolidation'
  if (d.role === 'exchange_deposit') return d.entity
  if (d.role === 'exchange_hot') return `${d.entity} hot wallet`
  return d.entity || ''
}

export function RoleGlyph({ role, size = 14 }) {
  const r = ROLES[role]
  const p = d3.symbol(SYMBOL[r.shape], r.shape === 'circle' ? 40 : r.shape === 'triangle' ? 36 : 46)()
  return (
    <svg width={size} height={size} viewBox="-8 -8 16 16" aria-hidden="true">
      <path d={p} fill={r.color} />
    </svg>
  )
}

export default function TxGraph({ nodes, transactions, highlight, selected, onSelect, height = 560 }) {
  const wrapRef = useRef(null)
  const svgRef = useRef(null)
  const zoomRef = useRef(null)
  const gRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const [tip, setTip] = useState(null)

  // aggregate txs per wallet pair + pre-compute a stable layered layout
  const graph = useMemo(() => {
    const ns = nodes.map((n) => ({ ...n, id: n.address }))
    const ids = new Set(ns.map((n) => n.id))
    const agg = new Map()
    for (const t of transactions) {
      if (!ids.has(t.from_address) || !ids.has(t.to_address)) continue
      const k = `${t.from_address}>${t.to_address}`
      const e = agg.get(k) || { source: t.from_address, target: t.to_address, value: 0, amount: 0, count: 0, inferred: false, token: t.token }
      e.value += t.value_inr
      e.amount += t.amount
      e.count++
      e.inferred = e.inferred || t.inferred
      agg.set(k, e)
    }
    const links = [...agg.values()]
    const cols = d3.group(ns, (d) => d.hop)
    cols.forEach((arr) => arr.forEach((n, i) => { n.x = (n.hop + 1) * COL; n.y = (i - (arr.length - 1) / 2) * 56 }))
    const sim = d3.forceSimulation(ns)
      .force('link', d3.forceLink(links).id((d) => d.id).distance(COL * 0.8).strength(0.12))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('x', d3.forceX((d) => (d.hop + 1) * COL).strength(1.5))
      .force('y', d3.forceY(0).strength(0.05))
      .force('collide', d3.forceCollide((d) => radius(d) + 17))
      .stop()
    for (let i = 0; i < 320; i++) sim.tick()
    const maxV = d3.max(links, (l) => l.value) || 1
    const width = d3.scaleSqrt().domain([0, maxV]).range([1.2, 9])
    return { ns, links, cols, width }
  }, [nodes, transactions])

  const fit = (animate = true) => {
    const svg = d3.select(svgRef.current)
    const W = wrapRef.current.clientWidth
    const [x0, x1] = d3.extent(graph.ns, (d) => d.x)
    const [y0, y1] = d3.extent(graph.ns, (d) => d.y)
    const bw = x1 - x0 + 140
    const bh = y1 - y0 + 150
    const k = Math.min(W / bw, height / bh, 1.4)
    const t = d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, height / 2 - k * ((y0 + y1) / 2 - 12)).scale(k)
    ;(animate ? svg.transition().duration(500) : svg).call(zoomRef.current.transform, t)
  }

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const defs = svg.append('defs')
    for (const [id, c] of [['arr', EDGE], ['arr-hl', EDGE_HL]]) {
      defs.append('marker').attr('id', id).attr('viewBox', '0 -5 10 10').attr('refX', 9).attr('refY', 0)
        .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', c)
    }
    const g = svg.append('g')
    gRef.current = g

    // hop column headers + guides
    const hops = [...graph.cols.keys()].sort((a, b) => a - b)
    const yTop = d3.min(graph.ns, (d) => d.y) - 48
    const yBot = d3.max(graph.ns, (d) => d.y) + 40
    const guides = g.append('g')
    guides.selectAll('line').data(hops).join('line')
      .attr('x1', (h) => (h + 1) * COL).attr('x2', (h) => (h + 1) * COL).attr('y1', yTop + 10).attr('y2', yBot)
      .attr('stroke', '#eef1f6').attr('stroke-width', 1)
    guides.selectAll('text').data(hops).join('text')
      .attr('x', (h) => (h + 1) * COL).attr('y', yTop).attr('text-anchor', 'middle')
      .attr('font-size', 10.5).attr('font-weight', 600).attr('letter-spacing', '0.08em').attr('fill', '#7b8699')
      .text((h) => (h === -1 ? 'SOURCES' : h === 0 ? 'REPORTED' : `HOP ${h}`))

    const linkPath = (d) => {
      const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y
      const dx = tx - sx, dy = ty - sy
      const len = Math.hypot(dx, dy) || 1
      const rt = radius(d.target) + 4
      const ex = tx - (dx / len) * rt, ey = ty - (dy / len) * rt
      const mx = (sx + ex) / 2 - dy * 0.08, my = (sy + ey) / 2 + dx * 0.08
      return `M${sx},${sy}Q${mx},${my} ${ex},${ey}`
    }

    const link = g.append('g').attr('fill', 'none').selectAll('path').data(graph.links).join('path')
      .attr('class', 'link').attr('d', linkPath).attr('stroke', EDGE).attr('stroke-opacity', 0.9)
      .attr('stroke-width', (d) => graph.width(d.value)).attr('stroke-dasharray', (d) => (d.inferred ? '5 4' : null))
      .attr('marker-end', 'url(#arr)')

    const node = g.append('g').selectAll('g').data(graph.ns).join('g')
      .attr('class', 'node').attr('transform', (d) => `translate(${d.x},${d.y})`).style('cursor', 'pointer')

    node.append('circle').attr('class', 'sel').attr('r', (d) => radius(d) + 6)
      .attr('fill', 'none').attr('stroke', EDGE_HL).attr('stroke-width', 2.5).attr('opacity', 0)
    node.filter((d) => d.role === 'suspect').append('circle').attr('r', (d) => radius(d) + 4)
      .attr('fill', 'none').attr('stroke', ROLES.suspect.color).attr('stroke-width', 1.5).attr('stroke-dasharray', '3 2')
    node.append('path')
      .attr('d', (d) => d3.symbol(SYMBOL[ROLES[d.role].shape], area(d))())
      .attr('fill', (d) => ROLES[d.role].color).attr('stroke', '#fff').attr('stroke-width', 2)
    node.filter((d) => LABELLED.has(d.role)).append('text')
      .attr('y', (d) => (d.role === 'exchange_hot' ? -radius(d) - 8 : radius(d) + 15)).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 600)
      .attr('fill', '#0f172a').attr('stroke', '#fff').attr('stroke-width', 3.5).attr('paint-order', 'stroke')
      .text(labelFor)

    const neighbours = (d) => {
      const s = new Set([d.id])
      graph.links.forEach((l) => { if (l.source.id === d.id) s.add(l.target.id); if (l.target.id === d.id) s.add(l.source.id) })
      return s
    }
    node
      .on('click', (e, d) => { e.stopPropagation(); onSelectRef.current?.(d) })
      .on('mouseenter', (e, d) => {
        const nb = neighbours(d)
        node.attr('opacity', (n) => (nb.has(n.id) ? 1 : 0.25))
        link.attr('opacity', (l) => (l.source.id === d.id || l.target.id === d.id ? 1 : 0.15))
        const r = wrapRef.current.getBoundingClientRect()
        setTip({ d, x: e.clientX - r.left, y: e.clientY - r.top })
      })
      .on('mouseleave', () => {
        node.attr('opacity', 1)
        link.attr('opacity', 1)
        setTip(null)
      })
      .call(
        d3.drag()
          .on('start', () => setTip(null))
          .on('drag', function (e, d) {
            d.x = e.x
            d.y = e.y
            d3.select(this).attr('transform', `translate(${d.x},${d.y})`)
            link.filter((l) => l.source === d || l.target === d).attr('d', linkPath)
          }),
      )

    // wheel zooms only with Ctrl/⌘ so the page still scrolls normally over the graph
    const zoom = d3.zoom().scaleExtent([0.15, 4])
      .filter((e) => (e.type === 'wheel' ? e.ctrlKey || e.metaKey : !e.button))
      .on('zoom', (e) => g.attr('transform', e.transform))
    zoomRef.current = zoom
    svg.call(zoom).on('dblclick.zoom', null)
    svg.on('click', () => onSelectRef.current?.(null))
    fit(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, height])

  // cheap restyle for highlight / selection (no re-layout)
  useEffect(() => {
    const g = gRef.current
    if (!g) return
    const hl = highlight || new Set()
    const on = (l) => hl.has(l.source.id) && hl.has(l.target.id)
    g.selectAll('path.link').attr('stroke', (l) => (on(l) ? EDGE_HL : EDGE)).attr('marker-end', (l) => (on(l) ? 'url(#arr-hl)' : 'url(#arr)'))
      .filter(on).raise()
    g.selectAll('g.node').select('circle.sel').attr('opacity', (d) => (d.id === selected ? 1 : 0))
  }, [highlight, selected, graph])

  const z = (k) => d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, k)

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-lg bg-[#fbfcfe]" style={{ height }}>
      <svg ref={svgRef} width="100%" height={height} role="img" aria-label="Transaction flow graph" />
      <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-lg border border-line bg-white shadow-sm">
        <button onClick={() => z(1.3)} className="p-2 text-ink-2 hover:bg-slate-50" aria-label="Zoom in"><Plus size={16} /></button>
        <button onClick={() => z(1 / 1.3)} className="border-t border-line p-2 text-ink-2 hover:bg-slate-50" aria-label="Zoom out"><Minus size={16} /></button>
        <button onClick={() => fit()} className="border-t border-line p-2 text-ink-2 hover:bg-slate-50" aria-label="Fit to screen"><Maximize2 size={15} /></button>
      </div>
      {tip && (
        <div
          className="pointer-events-none absolute z-10 w-64 rounded-lg bg-navy-900 p-3 text-xs text-brand-100 shadow-lg"
          style={{ left: Math.min(tip.x + 14, (wrapRef.current?.clientWidth || 600) - 270), top: tip.y + 14 }}
        >
          <div className="flex items-center gap-1.5 font-semibold text-white"><RoleGlyph role={tip.d.role} size={12} /> {ROLES[tip.d.role].label}</div>
          {tip.d.entity && <div className="mt-0.5 text-white">{tip.d.entity}</div>}
          <div className="mt-1 font-mono text-[11px]">{short(tip.d.address, 12, 8)}</div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span>Hop</span><span className="text-right text-white">{tip.d.hop < 0 ? 'source' : tip.d.hop}</span>
            <span>Received</span><span className="text-right text-white">{inrShort(tip.d.in_inr)}</span>
            <span>Sent</span><span className="text-right text-white">{inrShort(tip.d.out_inr)}</span>
            <span>Transactions</span><span className="text-right text-white">{tip.d.tx_count}</span>
          </div>
          <div className="mt-2 text-[10.5px] text-brand-200/70">Click for details · drag to move</div>
        </div>
      )}
    </div>
  )
}
