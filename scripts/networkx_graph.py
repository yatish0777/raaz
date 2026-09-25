#!/usr/bin/env python3
"""
RAAZ - NetworkX graph analysis on the dummy dataset.

Reads   public/data/cases/<id>.json   (written by generate_data.py)
Writes  public/data/nx/<id>.json      per-case graph metrics + NetworkX layouts (used by the app)
        public/data/nx/global.json    cross-case graph: which cases share wallets
        public/data/nx/png/*.png      matplotlib renders of the graphs (for PPT / report)
        data/csv/nx_case_metrics.csv  one row of graph metrics per case

This is the same analysis the FastAPI backend will run on live blockchain data.

Run:  python scripts/networkx_graph.py [--no-png]
"""
import argparse
import csv
import json
import os
from collections import defaultdict
from itertools import combinations, islice

import networkx as nx

ap = argparse.ArgumentParser()
ap.add_argument("--no-png", action="store_true", help="skip matplotlib PNG export")
ARGS = ap.parse_args()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public", "data")
OUT = os.path.join(DATA, "nx")
PNG = os.path.join(OUT, "png")
CSV_DIR = os.path.join(ROOT, "data", "csv")
SEED = 26183

# wallets shared by many unrelated cases because they are public infrastructure, not the fraudster
INFRA_ROLES = {"exchange_hot", "mixer", "bridge"}
ROLE_COLORS = {
    "victim": "#1baf7a", "inbound": "#e87ba4", "dust": "#b5b3ab", "suspect": "#e34948", "intermediary": "#7b8699",
    "consolidation": "#eb6834", "mixer": "#4a3aa7", "bridge": "#eda100", "exchange_deposit": "#2a78d6", "exchange_hot": "#0d366b",
}
ROLE_MARKER = {"mixer": "D", "bridge": "^", "exchange_deposit": "s", "exchange_hot": "s"}


def r4(x):
    return round(float(x), 4)


def build_case_graph(d):
    """Directed, weighted transaction graph. Parallel transfers between two wallets are merged into one edge."""
    G = nx.DiGraph(case_id=d["case"]["id"])
    for n in d["nodes"]:
        G.add_node(n["address"], role=n["role"], hop=n["hop"], label=n["label"], entity=n.get("entity"),
                   network=n["network"], in_inr=n["in_inr"], out_inr=n["out_inr"])
    for t in d["transactions"]:
        u, v = t["from_address"], t["to_address"]
        if G.has_edge(u, v):
            e = G[u][v]
            e["value_inr"] += t["value_inr"]
            e["count"] += 1
            e["inferred"] = e["inferred"] or t["inferred"]
        else:
            G.add_edge(u, v, value_inr=t["value_inr"], count=1, inferred=t["inferred"], kind=t["kind"])
    return G


def norm_pos(pos):
    """Scale a NetworkX layout into [0, 1] x [0, 1] for the SVG renderer."""
    xs = [p[0] for p in pos.values()]
    ys = [p[1] for p in pos.values()]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    sx, sy = (x1 - x0) or 1, (y1 - y0) or 1
    return {k: [r4((p[0] - x0) / sx), r4((p[1] - y0) / sy)] for k, p in pos.items()}


def analyse_case(d):
    G = build_case_graph(d)
    cid = d["case"]["id"]
    suspect = next(n for n, a in G.nodes(data=True) if a["role"] == "suspect")
    deposits = [n for n, a in G.nodes(data=True) if a["role"] == "exchange_deposit"]
    nearest = d["attributions"][0] if d["attributions"] else None
    targets = nearest["deposit_addresses"] if nearest else []

    # --- centrality ---------------------------------------------------------
    betweenness = nx.betweenness_centrality(G, normalized=True)
    pagerank = nx.pagerank(G, weight="value_inr", alpha=0.85)

    # --- reachability: hops from the reported wallet to every exchange deposit
    hops_to = nx.single_source_shortest_path_length(G, suspect)
    deposit_hops = {dep: hops_to.get(dep) for dep in deposits}

    # --- all simple paths to the nearest exchange, with bottleneck value ------
    paths = []
    for tgt in targets:
        for p in islice(nx.all_simple_paths(G, suspect, tgt, cutoff=14), 25):
            vals = [G[a][b]["value_inr"] for a, b in zip(p, p[1:])]
            paths.append(dict(path=p, hops=len(p) - 1, bottleneck_inr=min(vals),
                              via_mixer=any(G.nodes[x]["role"] == "mixer" for x in p),
                              via_bridge=any(G.nodes[x]["role"] == "bridge" for x in p)))
    paths.sort(key=lambda x: (-x["bottleneck_inr"], x["hops"]))
    path_edges = {(a, b) for p in paths for a, b in zip(p["path"], p["path"][1:])}

    # --- max flow: the most money that can be pushed from the reported wallet to ANY exchange
    max_flow_inr, flow_edges = 0, {}
    if deposits:
        H = nx.DiGraph()
        for u, v, a in G.edges(data=True):
            H.add_edge(u, v, capacity=a["value_inr"])
        for dep in deposits:
            H.add_edge(dep, "__EXCHANGES__")  # no capacity attr = infinite
        max_flow_inr, fd = nx.maximum_flow(H, suspect, "__EXCHANGES__", capacity="capacity")
        flow_edges = {(u, v): f for u, vs in fd.items() for v, f in vs.items() if f > 0 and v != "__EXCHANGES__"}

    # --- communities (Louvain on the undirected, value-weighted graph) --------
    comms = nx.community.louvain_communities(G.to_undirected(), weight="value_inr", seed=SEED)
    comms = sorted(comms, key=len, reverse=True)
    community_of = {n: i for i, c in enumerate(comms) for n in c}
    modularity = nx.community.modularity(G.to_undirected(), comms, weight="value_inr")

    # --- layouts ------------------------------------------------------------
    for n, a in G.nodes(data=True):
        a["layer"] = a["hop"] + 1
    pos_layers = norm_pos(nx.multipartite_layout(G, subset_key="layer", align="vertical"))
    pos_spring = norm_pos(nx.spring_layout(G, seed=SEED, k=0.9, iterations=200, weight=None))
    pos_kk = norm_pos(nx.kamada_kawai_layout(G.to_undirected()))

    und = G.to_undirected()
    stats = dict(
        nodes=G.number_of_nodes(), edges=G.number_of_edges(), density=r4(nx.density(G)),
        is_dag=nx.is_directed_acyclic_graph(G), weak_components=nx.number_weakly_connected_components(G),
        avg_clustering=r4(nx.average_clustering(und)), diameter=nx.diameter(und) if nx.is_connected(und) else None,
        max_out_degree=max(dict(G.out_degree()).values()), max_in_degree=max(dict(G.in_degree()).values()),
        communities=len(comms), modularity=r4(modularity), max_flow_to_exchanges_inr=int(max_flow_inr),
        reachable_wallets=len(hops_to) - 1, paths_to_nearest=len(paths),
        shortest_hops_to_nearest=min((deposit_hops[t] for t in targets if deposit_hops.get(t) is not None), default=None),
    )

    nodes = []
    for n, a in G.nodes(data=True):
        nodes.append(dict(
            id=n, role=a["role"], hop=a["hop"], entity=a["entity"], network=a["network"], in_inr=a["in_inr"], out_inr=a["out_inr"],
            in_degree=G.in_degree(n), out_degree=G.out_degree(n), betweenness=r4(betweenness[n]), pagerank=r4(pagerank[n]),
            community=community_of[n], hops_from_reported=hops_to.get(n),
            pos={"layers": pos_layers[n], "spring": pos_spring[n], "kamada_kawai": pos_kk[n]},
        ))
    edges = [dict(source=u, target=v, value_inr=a["value_inr"], count=a["count"], inferred=a["inferred"],
                  on_path=(u, v) in path_edges, flow_inr=int(flow_edges.get((u, v), 0)))
             for u, v, a in G.edges(data=True)]
    key_wallets = sorted(
        (n for n in nodes if n["role"] not in ("victim", "inbound", "dust")),
        key=lambda n: -n["betweenness"])[:8]

    out = dict(case_id=cid, algorithm_notes=dict(
        betweenness="nx.betweenness_centrality (normalized): wallets many fund routes pass through",
        pagerank="nx.pagerank weighted by INR value: where money accumulates",
        paths="nx.all_simple_paths from reported wallet to nearest exchange deposit(s), cutoff 14",
        max_flow="nx.maximum_flow with edge capacity = INR transferred, super-sink joining all exchange deposits",
        communities="nx.community.louvain_communities on undirected value-weighted graph",
        layouts="nx.multipartite_layout (by hop), nx.spring_layout, nx.kamada_kawai_layout"),
        stats=stats, nodes=nodes, edges=edges, key_wallets=[k["id"] for k in key_wallets],
        paths=paths[:12], communities=[sorted(c) for c in comms])
    return G, out


def draw_png(G, pos, path, title, color_by=None):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(13, 6.5), dpi=130)
    widths = [0.6 + 3.2 * (a["value_inr"] / max(1, max(e["value_inr"] for _, _, e in G.edges(data=True)))) ** 0.5
              for _, _, a in G.edges(data=True)]
    nx.draw_networkx_edges(G, pos, ax=ax, width=widths, edge_color="#b8c0cc", arrows=True, arrowsize=10,
                           connectionstyle="arc3,rad=0.06", node_size=180)
    for role, color in ROLE_COLORS.items():
        ns = [n for n, a in G.nodes(data=True) if a["role"] == role]
        if ns:
            nx.draw_networkx_nodes(G, pos, nodelist=ns, node_color=color, node_shape=ROLE_MARKER.get(role, "o"),
                                   node_size=[320 if role in ("suspect", "exchange_hot") else 200 for _ in ns],
                                   edgecolors="white", linewidths=1.2, ax=ax, label=role.replace("_", " "))
    labels = {n: (a["entity"] or ("Reported wallet" if a["role"] == "suspect" else "Victim" if a["role"] == "victim" else ""))
              for n, a in G.nodes(data=True) if a["role"] in ("suspect", "victim", "exchange_deposit", "mixer", "bridge")}
    nx.draw_networkx_labels(G, {k: (v[0], v[1] - 0.045) for k, v in pos.items()}, labels=labels, font_size=7.5, ax=ax)
    ax.set_title(title, fontsize=12, loc="left")
    ax.legend(loc="upper left", bbox_to_anchor=(1.0, 1.0), fontsize=8, frameon=False, markerscale=0.7)
    ax.axis("off")
    fig.text(0.01, 0.01, "DEMO DATA - addresses and exchange names are fictional", fontsize=7, color="#7b8699")
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)


def main():
    os.makedirs(OUT, exist_ok=True)
    if not ARGS.no_png:
        os.makedirs(PNG, exist_ok=True)
    cases = json.load(open(os.path.join(DATA, "cases.json"), encoding="utf-8"))
    graphs, rows = {}, []

    for c in cases:
        d = json.load(open(os.path.join(DATA, "cases", f"{c['id']}.json"), encoding="utf-8"))
        G, out = analyse_case(d)
        graphs[c["id"]] = G
        with open(os.path.join(OUT, f"{c['id']}.json"), "w", encoding="utf-8") as fh:
            json.dump(out, fh, separators=(",", ":"))
        rows.append(dict(case_id=c["id"], network=c["network"], nearest_exchange=c["nearest_exchange"] or "", **out["stats"]))
        if not ARGS.no_png:
            pos = {n["id"]: (n["pos"]["layers"][0], n["pos"]["layers"][1]) for n in out["nodes"]}
            draw_png(G, pos, os.path.join(PNG, f"{c['id']}.png"), f"{c['id']} - {c['fraud_type']} ({c['network']})")

    # ---------------- cross-case graph ----------------------------------------
    U = nx.compose_all(list(graphs.values()))
    wallet_cases = defaultdict(set)
    for cid, G in graphs.items():
        for n, a in G.nodes(data=True):
            if a["role"] not in INFRA_ROLES:
                wallet_cases[n].add(cid)
    shared = {w: cs for w, cs in wallet_cases.items() if len(cs) > 1}

    C = nx.Graph()
    by_id = {c["id"]: c for c in cases}
    for c in cases:
        C.add_node(c["id"])
    for w, cs in shared.items():
        for a, b in combinations(sorted(cs), 2):
            if C.has_edge(a, b):
                C[a][b]["weight"] += 1
                C[a][b]["wallets"].append(w)
            else:
                C.add_edge(a, b, weight=1, wallets=[w])

    groups = sorted((g for g in nx.connected_components(C) if len(g) > 1), key=len, reverse=True)
    group_of = {n: i for i, g in enumerate(groups) for n in g}
    # layout: each linked group drawn as its own nx.circular_layout "wheel" side by side (groups are
    # cliques, so a spring layout would collapse them); unlinked cases sit in a grid strip below
    pos = {}
    ng = max(1, len(groups))
    for i, grp in enumerate(groups):
        cx = (i + 0.5) / ng
        rad = 0.05 + 0.02 * len(grp) ** 0.5
        for n, (x, y) in nx.circular_layout(C.subgraph(grp), scale=rad).items():
            pos[n] = (cx + x, 0.62 + y * 1.6)
    isolates = sorted(n for n in C.nodes if n not in group_of)
    cols = 19
    for j, n in enumerate(isolates):
        pos[n] = ((j % cols + 0.5) / cols, 0.12 - (j // cols) * 0.09)
    pos = norm_pos(pos)
    # exchanges shared across cases (infrastructure) - for the "who receives most" view
    hot_in = defaultdict(set)
    for cid, G in graphs.items():
        for n, a in G.nodes(data=True):
            if a["role"] == "exchange_deposit":
                hot_in[a["entity"]].add(cid)

    Uu = U.to_undirected()
    deg = nx.degree_centrality(U)
    top_wallets = sorted((n for n in U.nodes if U.nodes[n]["role"] not in ("victim", "inbound", "dust")), key=lambda n: -deg[n])[:15]

    glob = dict(
        stats=dict(wallets=U.number_of_nodes(), transfers=U.number_of_edges(), weak_components=nx.number_weakly_connected_components(U),
                   cases=len(cases), linked_cases=sum(len(g) for g in groups), linked_groups=len(groups), shared_wallets=len(shared),
                   case_link_edges=C.number_of_edges()),
        case_nodes=[dict(id=cid, pos=pos[cid], group=group_of.get(cid), degree=C.degree(cid), network=by_id[cid]["network"],
                         amount_lost_inr=by_id[cid]["amount_lost_inr"], risk_score=by_id[cid]["risk_score"],
                         syndicate=by_id[cid]["syndicate"], nearest_exchange=by_id[cid]["nearest_exchange"], status=by_id[cid]["status"])
                    for cid in C.nodes],
        case_edges=[dict(source=a, target=b, shared_wallets=e["weight"], wallets=e["wallets"]) for a, b, e in C.edges(data=True)],
        groups=[dict(id=i, cases=sorted(g), size=len(g),
                     shared_wallets=sorted({w for a, b in C.subgraph(g).edges for w in C[a][b]["wallets"]}),
                     total_lost_inr=sum(by_id[x]["amount_lost_inr"] for x in g),
                     networks=sorted({by_id[x]["network"] for x in g}),
                     exchanges=sorted({by_id[x]["nearest_exchange"] for x in g if by_id[x]["nearest_exchange"]}))
                for i, g in enumerate(groups)],
        exchanges_by_cases=sorted(([k, len(v)] for k, v in hot_in.items()), key=lambda x: -x[1]),
        top_wallets=[dict(id=n, role=U.nodes[n]["role"], entity=U.nodes[n]["entity"], network=U.nodes[n]["network"],
                          degree=U.degree(n), cases=sorted(wallet_cases.get(n, [c for c, G in graphs.items() if n in G])))
                     for n in top_wallets],
        algorithm_notes=dict(
            union="nx.compose_all over every case graph",
            case_links="cases joined when they share a non-infrastructure wallet (excludes exchange hot wallets, mixers, bridges)",
            groups="nx.connected_components on the case-link graph",
            layout="nx.circular_layout per linked group; unlinked cases in a grid"),
    )
    with open(os.path.join(OUT, "global.json"), "w", encoding="utf-8") as fh:
        json.dump(glob, fh, separators=(",", ":"))

    if not ARGS.no_png:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        palette = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]
        fig, ax = plt.subplots(figsize=(11, 8), dpi=130)
        p = {k: tuple(v) for k, v in pos.items()}
        nx.draw_networkx_edges(C, p, width=[0.8 + e["weight"] for _, _, e in C.edges(data=True)], edge_color="#b8c0cc", ax=ax)
        colors = [palette[group_of[n] % len(palette)] if n in group_of else "#d5d9e0" for n in C.nodes]
        sizes = [120 + by_id[n]["amount_lost_inr"] / 25_000 for n in C.nodes]
        nx.draw_networkx_nodes(C, p, node_color=colors, node_size=sizes, edgecolors="white", linewidths=1, ax=ax)
        nx.draw_networkx_labels(C, p, labels={n: n[-4:] for n in C.nodes if n in group_of}, font_size=7, ax=ax)
        ax.set_title("RAAZ - cases linked by shared wallets (NetworkX)", loc="left")
        ax.axis("off")
        fig.tight_layout()
        fig.savefig(os.path.join(PNG, "global_case_links.png"), bbox_inches="tight")
        plt.close(fig)

    os.makedirs(CSV_DIR, exist_ok=True)
    with open(os.path.join(CSV_DIR, "nx_case_metrics.csv"), "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    print(json.dumps(glob["stats"]))
    print("groups:", [(g["cases"], len(g["shared_wallets"])) for g in glob["groups"]])


if __name__ == "__main__":
    main()
