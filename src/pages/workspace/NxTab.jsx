import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Download, Network } from 'lucide-react'
import { getNx } from '../../lib/api'
import { ROLES, inrShort, short } from '../../lib/format'
import { Address, Card, ErrorBox, Loading, useAsync } from '../../components/ui'
import NxGraphView, { CATEGORICAL } from '../../components/NxGraphView'
import { RoleGlyph } from '../../components/TxGraph'

function Seg({ value, onChange, options }) {
  return (
    <div className="flex rounded-lg border border-line p-0.5 text-xs">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={`rounded-md px-2.5 py-1 font-medium whitespace-nowrap ${value === v ? 'bg-navy-900 text-white' : 'text-ink-2 hover:text-ink'}`}>{l}</button>
      ))}
    </div>
  )
}

export default function NxTab({ d }) {
  const { data: nx, error, loading } = useAsync(() => getNx(d.case.id), [d.case.id])
  const [layout, setLayout] = useState('layers')
  const [sizeBy, setSizeBy] = useState('betweenness')
  const [colorBy, setColorBy] = useState('role')
  const [showPaths, setShowPaths] = useState(true)
  const [sel, setSel] = useState(null)

  if (loading) return <Loading label="Loading NetworkX analysis…" />
  if (error) return <ErrorBox error={error} />
  const s = nx.stats
  const byId = Object.fromEntries(nx.nodes.map((n) => [n.id, n]))
  const selNode = sel && byId[sel]
  const keyWallets = nx.key_wallets.map((id) => byId[id])

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
        <Network size={16} className="mt-0.5 shrink-0" />
        <span>
          This graph was built and analysed in Python with <b>NetworkX</b> (<code className="font-mono text-xs">scripts/networkx_graph.py</code>).
          The layouts, centrality, paths, max-flow and communities below all come from NetworkX.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {[
          ['Nodes / edges', `${s.nodes} / ${s.edges}`, 'nx.DiGraph'],
          ['Density', s.density, s.is_dag ? 'Acyclic (DAG)' : 'Has cycles'],
          ['Hops to nearest VASP', s.shortest_hops_to_nearest ?? '-', 'shortest_path_length'],
          ['Paths to nearest VASP', s.paths_to_nearest, 'all_simple_paths'],
          ['Max flow to exchanges', inrShort(s.max_flow_to_exchanges_inr), 'maximum_flow'],
          ['Communities', s.communities, `modularity ${s.modularity}`],
          ['Max fan-out', s.max_out_degree, `max fan-in ${s.max_in_degree}`],
        ].map(([k, v, sub]) => (
          <div key={k} className="card px-4 py-3">
            <div className="text-xs text-ink-3">{k}</div>
            <div className="text-lg font-bold text-navy-900">{v}</div>
            <div className="truncate font-mono text-[10.5px] text-ink-3">{sub}</div>
          </div>
        ))}
      </div>

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-ink-2">Layout <Seg value={layout} onChange={setLayout} options={[['layers', 'Hop layers'], ['spring', 'Spring'], ['kamada_kawai', 'Kamada-Kawai']]} /></div>
          <div className="flex items-center gap-2 text-xs text-ink-2">Size by <Seg value={sizeBy} onChange={setSizeBy} options={[['role', 'Role'], ['betweenness', 'Betweenness'], ['pagerank', 'PageRank']]} /></div>
          <div className="flex items-center gap-2 text-xs text-ink-2">Colour by <Seg value={colorBy} onChange={setColorBy} options={[['role', 'Role'], ['community', 'Community']]} /></div>
          <label className="flex items-center gap-2 text-xs font-medium text-ink">
            <input type="checkbox" className="size-4 accent-brand-600" checked={showPaths} onChange={(e) => setShowPaths(e.target.checked)} /> Paths to nearest VASP
          </label>
          {!nx.demo_generated && (
            <a href={`/data/nx/png/${d.case.id}.png`} download className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline">
              <Download size={14} /> PNG (matplotlib)
            </a>
          )}
        </div>
        <div className="grid xl:grid-cols-[1fr_280px]">
          <div className="bg-[#fbfcfe] p-2">
            <NxGraphView nx={nx} layout={layout} sizeBy={sizeBy} colorBy={colorBy} showPaths={showPaths} selected={sel} onSelect={(n) => setSel(n.id)} />
          </div>
          <div className="border-t border-line p-4 text-sm xl:border-t-0 xl:border-l">
            {selNode ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-navy-900"><RoleGlyph role={selNode.role} /> {ROLES[selNode.role].label}</div>
                {selNode.entity && <div className="text-brand-700">{selNode.entity}</div>}
                <Address value={selNode.id} head={10} tail={6} />
                <dl className="grid grid-cols-2 gap-y-1 pt-1 text-xs">
                  <dt className="text-ink-3">Betweenness</dt><dd className="text-right font-semibold">{selNode.betweenness}</dd>
                  <dt className="text-ink-3">PageRank</dt><dd className="text-right font-semibold">{selNode.pagerank}</dd>
                  <dt className="text-ink-3">In / out degree</dt><dd className="text-right">{selNode.in_degree} / {selNode.out_degree}</dd>
                  <dt className="text-ink-3">Hops from reported</dt><dd className="text-right">{selNode.hops_from_reported ?? 'not reachable'}</dd>
                  <dt className="text-ink-3">Community</dt><dd className="text-right">#{selNode.community + 1}</dd>
                  <dt className="text-ink-3">Received / sent</dt><dd className="text-right">{inrShort(selNode.in_inr)} / {inrShort(selNode.out_inr)}</dd>
                </dl>
                <button onClick={() => setSel(null)} className="text-xs text-ink-3 hover:text-ink">Clear selection</button>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-ink-2">
                <p>Click a wallet to see its NetworkX metrics. Hover over nodes and edges for quick values.</p>
                {colorBy === 'community' ? (
                  <ul className="space-y-1">
                    {nx.communities.slice(0, 8).map((c, i) => (
                      <li key={i} className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ background: CATEGORICAL[i] }} /> Community {i + 1} · {c.length} wallets</li>
                    ))}
                    {nx.communities.length > 8 && <li className="flex items-center gap-2"><span className="size-3 rounded-sm bg-[#c3c7cf]" /> {nx.communities.length - 8} smaller communities</li>}
                  </ul>
                ) : (
                  <ul className="space-y-1">
                    {Object.keys(ROLES).filter((r) => nx.nodes.some((n) => n.role === r)).map((r) => (
                      <li key={r} className="flex items-center gap-2"><RoleGlyph role={r} size={12} /> {ROLES[r].label}</li>
                    ))}
                  </ul>
                )}
                <p className="text-ink-3">{sizeBy === 'role' ? 'Node size = wallet role.' : `Node size = ${sizeBy === 'betweenness' ? 'betweenness centrality' : 'value-weighted PageRank'}.`} Line thickness = ₹ transferred. Dashed = probabilistic (mixer) link.</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Key wallets" subtitle="Ranked by betweenness centrality: the wallets most fund routes pass through" pad={false}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-ink-2">
              <tr>{['Wallet', 'Role', 'Betweenness', 'PageRank', 'In/Out'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keyWallets.map((n) => (
                <tr key={n.id} className={`cursor-pointer hover:bg-slate-50 ${sel === n.id ? 'bg-brand-50' : ''}`} onClick={() => setSel(n.id)}>
                  <td className="px-3 py-2 font-mono text-[12px]">{short(n.id, 7, 5)}</td>
                  <td className="px-3 py-2 text-xs"><span className="inline-flex items-center gap-1"><RoleGlyph role={n.role} size={10} />{n.entity || ROLES[n.role].label}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#2a78d6]" style={{ width: `${(100 * n.betweenness) / (keyWallets[0].betweenness || 1)}%` }} /></div>
                      <span className="tabular text-xs">{n.betweenness}</span>
                    </div>
                  </td>
                  <td className="tabular px-3 py-2 text-xs">{n.pagerank}</td>
                  <td className="tabular px-3 py-2 text-xs">{n.in_degree}/{n.out_degree}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Paths from the reported wallet to the nearest exchange" subtitle="nx.all_simple_paths, strongest first (bottleneck = smallest transfer on the path)" pad={false}>
          {nx.paths.length ? (
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {nx.paths.map((p, i) => (
                <li key={i} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-navy-900">Path {i + 1}</span>
                    <span className="text-ink-2">{p.hops} hops · bottleneck {inrShort(p.bottleneck_inr)}</span>
                    {p.via_mixer && <span className="rounded bg-violet-50 px-1.5 font-semibold text-violet-700">via mixer</span>}
                    {p.via_bridge && <span className="rounded bg-amber-50 px-1.5 font-semibold text-warn-ink">via bridge</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {p.path.map((a, j) => (
                      <span key={j} className="inline-flex items-center gap-1">
                        {j > 0 && <ArrowRight size={11} className="text-ink-3" />}
                        <button onClick={() => setSel(a)} className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] ring-1 ring-line hover:ring-brand-500" title={a}>
                          <RoleGlyph role={byId[a].role} size={9} />{byId[a].entity || short(a, 4, 3)}
                        </button>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5 text-sm text-ink-3">No exchange reached yet, so there's no path to show.</div>
          )}
        </Card>
      </div>

      <Card title="NetworkX functions used">
        <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          {Object.entries(nx.algorithm_notes).map(([k, v]) => (
            <div key={k}><dt className="text-xs font-semibold text-ink-3 uppercase">{k.replace('_', ' ')}</dt><dd className="text-ink-2">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-3">See also the <Link to="/network" className="text-brand-700 hover:underline">Network map</Link> for links between cases.</p>
      </Card>
    </div>
  )
}
