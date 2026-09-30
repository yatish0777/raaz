#!/usr/bin/env python3
"""
RAAZ - Automated Anti-Fraud Analysis
Dummy data generator for the SIH26183 prototype.

* Deterministic: the same SEED always produces the same dataset.
* Every wallet address and transaction hash is RANDOM - none are real.
* Every exchange, mixer, bridge, victim and investigator name is FICTIONAL.

Outputs:
  public/data/*.json          -> consumed by the React app (mock API)
  public/data/cases/<id>.json -> per-case investigation detail (graph, patterns, ...)
  data/csv/*.csv              -> for PPT / Excel / sharing

Run:  python scripts/generate_data.py [--cases 60] [--seed 26183]
"""
import argparse
import csv
import json
import math
import os
import random
from collections import defaultdict
from datetime import datetime, timedelta

ap = argparse.ArgumentParser()
ap.add_argument("--cases", type=int, default=60)
ap.add_argument("--seed", type=int, default=26183)
ARGS = ap.parse_args()

R = random.Random(ARGS.seed)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_JSON = os.path.join(ROOT, "public", "data")
OUT_CASES = os.path.join(OUT_JSON, "cases")
OUT_CSV = os.path.join(ROOT, "data", "csv")
NOW = datetime(2026, 9, 24, 10, 0, 0)

# --------------------------------------------------------------------------- #
# Reference data
# --------------------------------------------------------------------------- #
NETWORKS = {
    "TRON": dict(name="TRON", tokens=[("USDT", 1)], weight=45, block_time=3, block_now=76_412_000),
    "ETH": dict(name="Ethereum", tokens=[("USDT", 5), ("ETH", 3), ("USDC", 2)], weight=20, block_time=12, block_now=23_418_000),
    "BSC": dict(name="BNB Smart Chain", tokens=[("USDT", 7), ("BNB", 3)], weight=15, block_time=3, block_now=62_150_000),
    "BTC": dict(name="Bitcoin", tokens=[("BTC", 1)], weight=12, block_time=600, block_now=915_300),
    "POLYGON": dict(name="Polygon", tokens=[("USDT", 6), ("POL", 4)], weight=8, block_time=2, block_now=77_050_000),
}
PRICE_INR = {"USDT": 88.40, "USDC": 88.35, "BTC": 9_450_000, "ETH": 342_000, "BNB": 61_500, "POL": 42.50}
DECIMALS = {"BTC": 6, "ETH": 5, "BNB": 4}
ALL_NETS = list(NETWORKS)

# id, name, type, jurisdiction, fiu_ind_registered, kyc, cooperation, avg_response_days, networks, weight
EXCHANGES_RAW = [
    ("EX01", "NovaX Exchange", "Indian VASP", "India (Mumbai)", True, "Full KYC", "High", 3, ALL_NETS, 12),
    ("EX02", "Tarang Digital Assets", "Indian VASP", "India (Bengaluru)", True, "Full KYC", "High", 4, ALL_NETS, 10),
    ("EX03", "Suryodaya Crypto", "Indian VASP", "India (Gurugram)", True, "Full KYC", "Medium", 7, ["TRON", "ETH", "BSC", "BTC"], 7),
    ("EX04", "Zentra Global", "Offshore Exchange", "Seychelles", False, "Partial KYC", "Low", 30, ALL_NETS, 10),
    ("EX05", "Kestrel Markets", "Offshore Exchange", "Cayman Islands", False, "Partial KYC", "Medium", 21, ALL_NETS, 8),
    ("EX06", "Orbitra Pro", "Offshore Exchange (FIU-IND registered)", "UAE (Dubai)", True, "Full KYC", "Medium", 10, ALL_NETS, 7),
    ("EX07", "Halcyon Swap", "Offshore Exchange", "British Virgin Islands", False, "Minimal KYC", "Low", 45, ["TRON", "ETH", "BSC", "POLYGON"], 6),
    ("EX08", "Meridian OTC Desk", "OTC Desk", "Hong Kong", False, "Partial KYC", "Low", 35, ["TRON", "ETH", "BTC"], 6),
    ("EX09", "Pinecrest P2P", "P2P Platform", "Singapore", False, "Partial KYC", "Medium", 18, ["TRON", "ETH", "BSC"], 9),
    ("EX10", "Aurum Bitmarket", "Foreign Regulated Exchange", "Lithuania (EU)", False, "Full KYC", "High", 9, ALL_NETS, 4),
    ("EX11", "Lotus Chain Exchange", "Unregulated Exchange", "Cambodia", False, "Minimal KYC", "Low", None, ["TRON", "BSC"], 6),
    ("EX12", "Quasar Exchange", "Foreign Regulated Exchange", "Malta", False, "Full KYC", "Medium", 14, ALL_NETS, 4),
]
MIXERS = [("MX01", "Obscura Mixer", ["ETH", "BSC", "BTC"]), ("MX02", "Umbra Tumbler", ["BTC", "ETH"])]
BRIDGES = [("BR01", "ArcBridge", ["TRON", "ETH", "BSC", "POLYGON"]), ("BR02", "HopLink Bridge", ["ETH", "BSC", "POLYGON"])]

FRAUD_TYPES = [
    ("Investment / Trading App Fraud", 30),
    ("Task-based Part-time Job Fraud", 25),
    ("Pig-butchering (Romance-Investment)", 12),
    ("Fake Crypto Exchange / Wallet", 10),
    ("Digital Arrest Scam", 9),
    ("Ponzi / MLM Token Scheme", 8),
    ("Loan App Extortion", 6),
]
FRAUD_DESC = {
    "Investment / Trading App Fraud": "Complainant was added to a Telegram 'stock tips' group and induced to invest through a fake trading app that showed inflated profits. Withdrawals were blocked pending repeated 'tax' and 'unlock' payments in USDT.",
    "Task-based Part-time Job Fraud": "Complainant was offered a part-time job rating hotels and videos. After small initial payouts, they were asked to pre-pay in crypto for 'premium tasks'; the money was never returned.",
    "Pig-butchering (Romance-Investment)": "Complainant was befriended on a dating app and, over several weeks, persuaded to invest in a crypto platform controlled by the suspect.",
    "Fake Crypto Exchange / Wallet": "Complainant deposited crypto on a look-alike exchange website promoted through social-media ads. The account was frozen immediately after the deposit.",
    "Digital Arrest Scam": "Callers impersonating investigating-agency officers kept the complainant on a video call and coerced them to buy crypto and transfer it to a 'verification' wallet.",
    "Ponzi / MLM Token Scheme": "Complainant invested in a token scheme promising fixed daily returns and referral bonuses. The platform stopped withdrawals and went offline.",
    "Loan App Extortion": "After taking a small loan through an instant-loan app, complainant was harassed with morphed images and forced to pay 'settlement' amounts in crypto.",
}

STATES = {
    "Maharashtra": (27, ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik"]),
    "Karnataka": (29, ["Bengaluru Urban", "Mysuru", "Dakshina Kannada"]),
    "Delhi": (7, ["New Delhi", "South Delhi", "North West Delhi"]),
    "Telangana": (36, ["Hyderabad", "Rangareddy", "Warangal"]),
    "Tamil Nadu": (33, ["Chennai", "Coimbatore", "Madurai"]),
    "Uttar Pradesh": (9, ["Lucknow", "Gautam Buddh Nagar", "Ghaziabad", "Varanasi"]),
    "Rajasthan": (8, ["Jaipur", "Jodhpur", "Udaipur"]),
    "Gujarat": (24, ["Ahmedabad", "Surat", "Vadodara"]),
    "West Bengal": (19, ["Kolkata", "Howrah"]),
    "Punjab": (3, ["SAS Nagar (Mohali)", "Ludhiana", "Amritsar"]),
    "Haryana": (6, ["Gurugram", "Faridabad"]),
    "Kerala": (32, ["Ernakulam", "Thiruvananthapuram"]),
    "Madhya Pradesh": (23, ["Indore", "Bhopal"]),
    "Bihar": (10, ["Patna"]),
    "Odisha": (21, ["Khordha"]),
}
FIRST = ["Aarav", "Vivaan", "Aditya", "Rohan", "Karthik", "Sandeep", "Imran", "Rahul", "Vikram", "Harpreet",
         "Suresh", "Nikhil", "Pranav", "Manoj", "Abdul", "Joseph", "Anil", "Deepak", "Ramesh", "Siddharth",
         "Ananya", "Diya", "Kavya", "Sneha", "Pooja", "Neha", "Fatima", "Lakshmi", "Priyanka", "Meenakshi",
         "Ritu", "Swati", "Shreya", "Nandini", "Asha", "Gurleen", "Divya", "Aisha", "Sunita", "Rekha"]
LAST = ["Sharma", "Patel", "Reddy", "Iyer", "Nair", "Gupta", "Singh", "Khan", "Das", "Mehta", "Joshi",
        "Kulkarni", "Chatterjee", "Banerjee", "Verma", "Yadav", "Menon", "Pillai", "Gill", "Agarwal",
        "Saxena", "Mishra", "Rao", "Bhat", "Ansari", "D'Souza", "Thomas", "Pandey", "Chauhan", "Shetty"]

INVESTIGATORS = [
    dict(id="INV01", name="Ananya Sharma", rank="Senior Analyst", unit="I4C - National Cyber Forensic Lab, New Delhi", state=None, badge="I4C-AN-2231"),
    dict(id="INV02", name="Insp. Priya Deshmukh", rank="Inspector", unit="Maharashtra Cyber, Mumbai", state="Maharashtra", badge="MHC-4471"),
    dict(id="INV03", name="SI Arjun Rathore", rank="Sub-Inspector", unit="Cyber Crime Police Station, Jaipur", state="Rajasthan", badge="RJC-1187"),
    dict(id="INV04", name="DSP Kavitha Raman", rank="Deputy Superintendent", unit="Cyber Crime Wing, Chennai", state="Tamil Nadu", badge="TNC-0902"),
    dict(id="INV05", name="Insp. Rohit Verma", rank="Inspector", unit="Cyber Crime HQ, Lucknow", state="Uttar Pradesh", badge="UPC-3318"),
    dict(id="INV06", name="SI Farhan Qureshi", rank="Sub-Inspector", unit="Cyber Security Bureau, Hyderabad", state="Telangana", badge="TSC-2764"),
    dict(id="INV07", name="Meera Nair", rank="Analyst", unit="I4C - National Cyber Forensic Lab, New Delhi", state=None, badge="I4C-AN-2418"),
    dict(id="INV08", name="Insp. Gurpreet Sandhu", rank="Inspector", unit="State Cyber Crime Cell, Mohali", state="Punjab", badge="PBC-1650"),
]

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def hexs(n):
    return "".join(R.choice("0123456789abcdef") for _ in range(n))


def new_addr(net):
    if net == "BTC":
        return "bc1q" + "".join(R.choice(BECH32) for _ in range(38))
    if net == "TRON":
        return "T" + "".join(R.choice(B58) for _ in range(33))
    return "0x" + hexs(40)


def new_hash(net):
    return ("0x" if net in ("ETH", "BSC", "POLYGON") else "") + hexs(64)


def wchoice(pairs):
    items, weights = zip(*pairs)
    return R.choices(items, weights=weights)[0]


def rnd(token, x):
    return round(x, DECIMALS.get(token, 2))


def split(total, n, skew=1.0):
    w = [R.uniform(0.4, 1.6) ** skew for _ in range(n)]
    s = sum(w)
    return [total * x / s for x in w]


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S+05:30")


def block_at(net, ts):
    cfg = NETWORKS[net]
    return int(cfg["block_now"] - (NOW - ts).total_seconds() / cfg["block_time"])


def masked_phone():
    return "XXXXXX" + str(R.randint(1000, 9999))


EXCHANGES = [
    dict(id=e[0], name=e[1], type=e[2], jurisdiction=e[3], fiu_ind_registered=e[4], kyc_level=e[5],
         cooperation=e[6], avg_response_days=e[7], networks=e[8], weight=e[9],
         compliance_contact=f"lea-requests@{e[1].split()[0].lower()}.example")
    for e in EXCHANGES_RAW
]
EX_BY_ID = {e["id"]: e for e in EXCHANGES}
HOT = {(e["id"], n): new_addr(n) for e in EXCHANGES for n in e["networks"]}
MIXER_ADDR = {(m[0], n): new_addr(n) for m in MIXERS for n in m[2]}
BRIDGE_ADDR = {(b[0], n): new_addr(n) for b in BRIDGES for n in b[2]}


def pick_exchanges(net, k=1, prefer=None):
    pool = [e for e in (prefer or []) if net in e["networks"]]
    if len(pool) >= k:
        return R.sample(pool, k)
    cands = [e for e in EXCHANGES if net in e["networks"] and e not in pool]
    while len(pool) < k and cands:
        e = wchoice([(c, c["weight"]) for c in cands])
        pool.append(e)
        cands.remove(e)
    return pool


# Linked operator "syndicates": consolidation wallets reused across several cases
SYNDICATES = []
for i, (net, name) in enumerate([("TRON", "Syndicate A"), ("TRON", "Syndicate B"), ("BSC", "Syndicate C"), ("ETH", "Syndicate D")]):
    SYNDICATES.append(dict(id=f"SYN-{i+1:02d}", name=name, network=net, address=new_addr(net),
                           cluster_id=f"CL-SYN-{i+1:02d}", exchanges=pick_exchanges(net, 2), cases=[]))

ROLE_PRIORITY = ["exchange_hot", "exchange_deposit", "mixer", "bridge", "consolidation", "suspect", "intermediary", "dust", "inbound", "victim"]


# --------------------------------------------------------------------------- #
# Case builder
# --------------------------------------------------------------------------- #
class Case:
    def __init__(self, cid, net, token):
        self.cid, self.net, self.token = cid, net, token
        self.nodes, self.txs, self.flags, self.meta = {}, [], set(), defaultdict(list)
        self.syndicate = None
        self.case_ex = []

    def add(self, role, hop, net, label, address=None, entity=None, exchange_id=None):
        a = address or new_addr(net)
        if a in self.nodes:
            self.nodes[a]["hop"] = min(self.nodes[a]["hop"], hop)
            return a
        self.nodes[a] = dict(address=a, network=net, role=role, hop=hop, label=label, entity=entity, exchange_id=exchange_id)
        return a

    def tx(self, frm, to, amount, token, net, ts, kind, inferred=False, h=None, vout=0):
        amount = rnd(token, amount)
        if amount <= 0:
            return None
        h = h or new_hash(net)
        t = dict(id=f"{h}:{vout}" if net == "BTC" else h, hash=h, case_id=self.cid, network=net,
                 from_address=frm, to_address=to, amount=amount, token=token, _ts=ts, kind=kind, inferred=inferred)
        self.txs.append(t)
        return t

    def hop_dt(self):
        if "rapid" in self.flags:
            return timedelta(minutes=R.randint(2, 28))
        return timedelta(minutes=R.randint(45, 60 * 14))

    # ---- one branch of the layering tree -> list of endpoints ------------- #
    def run_branch(self, src, amt, hop, t, kind, net, token):
        eps, cur = [], src
        if kind == "peel":
            steps = R.randint(4, 7)
            self.meta["peel_steps"].append(steps)
            for _ in range(steps):
                t += self.hop_dt()
                peel = amt * R.uniform(0.05, 0.14)
                side = self.add("intermediary", hop + 1, net, "Peel-off wallet")
                nxt = self.add("intermediary", hop + 1, net, "Peel-chain change wallet")
                h = new_hash(net) if net == "BTC" else None
                self.tx(cur, side, peel, token, net, t, "peel", h=h, vout=0)
                self.tx(cur, nxt, amt - peel, token, net, t, "layering", h=h, vout=1)
                self.meta["peel_wallets"] += [side, nxt]
                eps.append(dict(addr=side, amt=peel, hop=hop + 1, t=t, net=net, token=token, deliver=R.random() < 0.4))
                amt -= peel
                cur, hop = nxt, hop + 1
            eps.append(dict(addr=cur, amt=amt, hop=hop, t=t, net=net, token=token, deliver=True))
        elif kind == "mixer":
            for _ in range(R.randint(1, 2)):
                t += self.hop_dt()
                nxt = self.add("intermediary", hop + 1, net, "Pre-mix staging wallet")
                self.tx(cur, nxt, amt, token, net, t, "layering")
                cur, hop = nxt, hop + 1
            mid, mname, _ = R.choice([m for m in MIXERS if net in m[2]])
            mx = self.add("mixer", hop + 1, net, f"{mname} (mixing service)", address=MIXER_ADDR[(mid, net)], entity=mname)
            t += self.hop_dt()
            self.tx(cur, mx, amt, token, net, t, "mixer_in")
            self.meta["mixer"].append(dict(name=mname, address=mx, amount=rnd(token, amt)))
            hop += 1
            t += timedelta(hours=R.randint(3, 40))
            for w in split(amt * 0.975, R.randint(2, 4)):
                o = self.add("intermediary", hop + 1, net, "Mixer output (probabilistic link)")
                tt = t + timedelta(minutes=R.randint(0, 300))
                self.tx(mx, o, w, token, net, tt, "mixer_out", inferred=True)
                eps.append(dict(addr=o, amt=w, hop=hop + 1, t=tt, net=net, token=token, deliver=True))
        elif kind == "bridge":
            dest = R.choice([n for n in ("ETH", "BSC", "POLYGON") if n != net])
            bid, bname, _ = R.choice([b for b in BRIDGES if net in b[2] and dest in b[2]])
            t += self.hop_dt()
            br = self.add("bridge", hop + 1, net, f"{bname} (cross-chain bridge)", address=BRIDGE_ADDR[(bid, net)], entity=bname)
            self.tx(cur, br, amt, token, net, t, "bridge_in")
            hop += 1
            t += timedelta(minutes=R.randint(3, 25))
            o = self.add("intermediary", hop + 1, dest, f"Bridge output wallet on {NETWORKS[dest]['name']}")
            amt *= 0.998
            self.tx(br, o, amt, token, dest, t, "bridge_out")
            self.meta["bridge"].append(dict(name=bname, from_network=net, to_network=dest, amount=rnd(token, amt)))
            cur, hop, net = o, hop + 1, dest
            for _ in range(R.randint(0, 2)):
                t += self.hop_dt()
                nxt = self.add("intermediary", hop + 1, net, "Post-bridge layering wallet")
                self.tx(cur, nxt, amt, token, net, t, "layering")
                cur, hop = nxt, hop + 1
            eps.append(dict(addr=cur, amt=amt, hop=hop, t=t, net=net, token=token, deliver=True))
        else:
            for _ in range(R.randint(1, 3)):
                t += self.hop_dt()
                nxt = self.add("intermediary", hop + 1, net, "Layering wallet")
                self.tx(cur, nxt, amt, token, net, t, "layering")
                cur, hop = nxt, hop + 1
            eps.append(dict(addr=cur, amt=amt, hop=hop, t=t, net=net, token=token, deliver=True))
        return eps

    # ---- endpoints -> exchange deposit addresses -> hot wallets ----------- #
    def deliver(self, eps):
        deposit_for = {}

        def deposit(ex, net, hop):
            key = (ex["id"], net)
            if key not in deposit_for:
                deposit_for[key] = self.add("exchange_deposit", hop, net, f"{ex['name']}: deposit address (attributed)",
                                            entity=ex["name"], exchange_id=ex["id"])
            else:
                self.nodes[deposit_for[key]]["hop"] = min(self.nodes[deposit_for[key]]["hop"], hop)
            return deposit_for[key]

        todo = [e for e in eps if e["deliver"]]
        if "consolidation" in self.flags:
            groups = defaultdict(list)
            for e in todo:
                groups[(e["net"], e["token"])].append(e)
            for (net, token), items in groups.items():
                hop = max(i["hop"] for i in items) + 1
                syn = self.syndicate if self.syndicate and self.syndicate["network"] == net else None
                cons = self.add("consolidation", hop, net, f"Consolidation wallet{' (' + syn['name'] + ')' if syn else ''}",
                                address=syn["address"] if syn else None)
                self.meta["consolidation"].append(cons)
                t = max(i["t"] for i in items)
                for i in items:
                    tt = i["t"] + self.hop_dt()
                    self.tx(i["addr"], cons, i["amt"], token, net, tt, "consolidation")
                    t = max(t, tt)
                total = sum(i["amt"] for i in items) * R.uniform(0.9, 1.0)
                exs = pick_exchanges(net, R.choice([1, 1, 2]), self.case_ex)
                for ex, part in zip(exs, split(total, len(exs))):
                    t += self.hop_dt()
                    self.tx(cons, deposit(ex, net, hop + 1), part, token, net, t, "exchange_deposit")
        else:
            for i in todo:
                ex = pick_exchanges(i["net"], 1, self.case_ex)[0]
                self.tx(i["addr"], deposit(ex, i["net"], i["hop"] + 1), i["amt"], i["token"], i["net"],
                        i["t"] + self.hop_dt(), "exchange_deposit")

        for (exid, net), d in deposit_for.items():
            ins = [x for x in self.txs if x["to_address"] == d]
            ex = EX_BY_ID[exid]
            hot = self.add("exchange_hot", self.nodes[d]["hop"] + 1, net, f"{ex['name']}: hot wallet",
                           address=HOT[(exid, net)], entity=ex["name"], exchange_id=exid)
            self.tx(d, hot, sum(x["amount"] for x in ins), ins[0]["token"], net,
                    max(x["_ts"] for x in ins) + timedelta(minutes=R.randint(5, 90)), "exchange_sweep")


def lognormal_amount():
    return int(round(math.exp(R.uniform(math.log(45_000), math.log(1.6e7))), -2))


def build_case(idx):
    cid = f"RAAZ-26-{1001 + idx}"
    net = wchoice([(k, v["weight"]) for k, v in NETWORKS.items()])
    token = wchoice(NETWORKS[net]["tokens"])
    c = Case(cid, net, token)
    fraud = wchoice(FRAUD_TYPES)
    amount_inr = lognormal_amount()
    price = PRICE_INR[token]

    # ---- modus operandi flags ---------------------------------------------
    if R.random() < 0.75: c.flags.add("fan_out")
    if R.random() < (0.7 if net == "BTC" else 0.35): c.flags.add("peel")
    if net in ("ETH", "BSC", "BTC") and R.random() < 0.3: c.flags.add("mixer")
    if token in ("USDT", "USDC") and net != "BTC" and R.random() < 0.3: c.flags.add("bridge")
    if R.random() < 0.5: c.flags.add("rapid")
    if R.random() < 0.5: c.flags.add("consolidation")
    if R.random() < 0.15: c.flags.add("dusting")
    held_only = R.random() < 0.07

    syn_cands = [s for s in SYNDICATES if s["network"] == net]
    if syn_cands and R.random() < 0.45 and not held_only:
        c.syndicate = R.choice(syn_cands)
        c.flags.add("consolidation")
        c.flags.discard("bridge")
        c.case_ex = c.syndicate["exchanges"]
        c.syndicate["cases"].append(cid)
    else:
        c.case_ex = pick_exchanges(net, R.choice([1, 2, 2]))

    # ---- inflows: victim payments + other inbound -------------------------
    t = datetime(2026, 1, 1) + timedelta(minutes=R.randint(0, 60 * 24 * 30))
    victim = c.add("victim", -1, net, "Complainant's wallet (victim)")
    suspect = c.add("suspect", 0, net, "Reported suspect wallet")
    n_pay = {"Digital Arrest Scam": R.randint(1, 2), "Task-based Part-time Job Fraud": R.randint(3, 6),
             "Pig-butchering (Romance-Investment)": R.randint(3, 7)}.get(fraud, R.randint(1, 4))
    total_tok = amount_inr / price
    parts = sorted(split(total_tok, n_pay, skew=1.6))
    first_pay = t
    for p in parts:
        c.tx(victim, suspect, p, token, net, t, "victim_payment")
        t += timedelta(hours=R.randint(3, 96)) if n_pay > 1 else timedelta(0)
    last_pay = max(x["_ts"] for x in c.txs)

    n_in = R.choice([0, 1, 2, 3, 4, 5])
    if n_in >= 2:
        c.flags.add("fan_in")
    inbound_total = 0.0
    for _ in range(n_in):
        a = total_tok * R.uniform(0.1, 1.1)
        src = c.add("inbound", -1, net, "Unattributed inbound (possible other victim)")
        c.tx(src, suspect, a, token, net, first_pay + timedelta(hours=R.randint(-72, 96)), "inbound")
        inbound_total += a
    if "dusting" in c.flags:
        d = c.add("dust", -1, net, "Dusting source")
        for _ in range(R.randint(3, 6)):
            c.tx(d, suspect, 0.00001 if token in ("BTC", "ETH") else 0.01, token, net,
                 first_pay - timedelta(hours=R.randint(1, 200)), "dust")

    # ---- layering ----------------------------------------------------------
    pool = (total_tok + inbound_total) * R.uniform(0.96, 1.0)
    layer_t = last_pay + timedelta(minutes=R.randint(10, 360))
    kinds = [k for k in ("mixer", "bridge", "peel") if k in c.flags]
    k = max(len(kinds), R.randint(3, 6) if "fan_out" in c.flags else R.randint(1, 2))
    kinds += ["direct"] * (k - len(kinds))
    R.shuffle(kinds)
    fan_h = new_hash(net) if net == "BTC" else None
    endpoints = []
    first_hop = []
    for i, (kind, share) in enumerate(zip(kinds, split(pool, k))):
        w1 = c.add("intermediary", 1, net, "Layer-1 distribution wallet")
        first_hop.append(w1)
        tt = layer_t + timedelta(minutes=0 if fan_h else R.randint(0, 40))
        c.tx(suspect, w1, share, token, net, tt, "layering", h=fan_h, vout=i)
        endpoints += c.run_branch(w1, share, 1, tt, kind, net, token)
    c.meta["first_hop"] = first_hop

    if held_only:
        c.flags.add("held")
    else:
        c.deliver(endpoints)

    return c, dict(fraud=fraud, amount_inr=amount_inr, first_pay=first_pay, last_pay=last_pay, n_pay=n_pay,
                   n_in=n_in, fan_k=k)


# --------------------------------------------------------------------------- #
# Analytics on a built case
# --------------------------------------------------------------------------- #
def analyse(c, info):
    nodes, txs = c.nodes, c.txs
    victim_inr = info["amount_inr"]
    # hop = shortest number of transfers from the reported wallet (BFS); source wallets stay at -1
    adj = defaultdict(list)
    for t in txs:
        adj[t["from_address"]].append(t["to_address"])
    susp0 = next(a for a, n in nodes.items() if n["role"] == "suspect")
    dist, queue = {susp0: 0}, [susp0]
    for a in queue:
        for b in adj[a]:
            if b not in dist:
                dist[b] = dist[a] + 1
                queue.append(b)
    for a, n in nodes.items():
        n["hop"] = dist.get(a, -1)

    stats = {a: dict(in_amount=0.0, out_amount=0.0, in_inr=0, out_inr=0, tx_count=0, first=None, last=None) for a in nodes}
    for t in txs:
        t["value_inr"] = int(round(t["amount"] * PRICE_INR[t["token"]]))
        t["hop"] = nodes[t["to_address"]]["hop"]
        for a, side in ((t["from_address"], "out"), (t["to_address"], "in")):
            s = stats[a]
            s[f"{side}_amount"] += t["amount"]
            s[f"{side}_inr"] += t["value_inr"]
            s["tx_count"] += 1
            s["first"] = min(s["first"] or t["_ts"], t["_ts"])
            s["last"] = max(s["last"] or t["_ts"], t["_ts"])
    for a, n in nodes.items():
        s = stats[a]
        n.update(in_amount=rnd(c.token, s["in_amount"]), out_amount=rnd(c.token, s["out_amount"]), in_inr=s["in_inr"],
                 out_inr=s["out_inr"], tx_count=s["tx_count"], first_seen=s["first"], last_seen=s["last"])
        n["balance"] = rnd(c.token, max(0.0, s["in_amount"] - s["out_amount"])) if n["role"] not in ("victim", "inbound", "dust", "mixer", "bridge", "exchange_hot") else None

    pool_inr = sum(t["value_inr"] for t in txs if t["kind"] in ("victim_payment", "inbound"))
    victim_ratio = victim_inr / pool_inr if pool_inr else 1

    # ---- exchange attribution ---------------------------------------------
    ex_rows = defaultdict(lambda: dict(amount_inr=0, deposits=set(), hops=99, networks=set(), mixer=False))
    for t in txs:
        if t["kind"] == "exchange_deposit":
            d = nodes[t["to_address"]]
            r = ex_rows[d["exchange_id"]]
            r["amount_inr"] += t["value_inr"]
            r["deposits"].add(d["address"])
            r["hops"] = min(r["hops"], d["hop"])
            r["networks"].add(d["network"])
    mixer_used = bool(c.meta["mixer"])
    attributions = []
    for exid, r in ex_rows.items():
        ex = EX_BY_ID[exid]
        conf = 0.93 - 0.035 * max(0, r["hops"] - 2) - (0.12 if mixer_used else 0) + R.uniform(-0.04, 0.03)
        conf = max(0.52, min(0.97, conf))
        attributions.append(dict(
            exchange_id=exid, exchange=ex["name"], type=ex["type"], jurisdiction=ex["jurisdiction"],
            fiu_ind_registered=ex["fiu_ind_registered"], hops=r["hops"], amount_inr=r["amount_inr"],
            pct_of_traced_pool=round(100 * r["amount_inr"] / pool_inr, 1),
            victim_attributable_inr=int(r["amount_inr"] * victim_ratio),
            deposit_addresses=sorted(r["deposits"]), networks=sorted(r["networks"]),
            confidence=round(conf, 2),
            evidence=[
                "Deposit address swept to a known exchange hot wallet",
                "Deposit address pattern matches exchange's per-user address scheme",
            ] + (["Path includes probabilistic mixer link - confidence reduced"] if mixer_used else []),
        ))
    attributions.sort(key=lambda a: (a["hops"], -a["amount_inr"]))
    nearest = attributions[0] if attributions else None

    held_inr = sum(int(n["balance"] * PRICE_INR[c.token]) for n in nodes.values()
                   if n["balance"] and n["role"] in ("suspect", "intermediary", "consolidation") and n["network"] == c.net)
    traced_to_vasp = sum(a["amount_inr"] for a in attributions)

    # ---- patterns ----------------------------------------------------------
    pats = []
    susp = [a for a, n in nodes.items() if n["role"] == "suspect"][0]

    def pat(ptype, sev, conf, desc, wallets):
        pats.append(dict(type=ptype, severity=sev, confidence=conf, description=desc, wallets=wallets[:12]))

    first_hop = c.meta["first_hop"]
    if len(first_hop) >= 3:
        pat("Fan-out distribution", "High", 0.91,
            f"Reported wallet split funds into {len(first_hop)} fresh wallets within minutes of the last victim payment.",
            [susp] + first_hop)
    if c.meta["peel_steps"]:
        pat("Peel chain", "High", 0.88,
            f"{sum(c.meta['peel_steps'])}-step peel chain: each hop sheds 5-14% to a side wallet and forwards the change.",
            c.meta["peel_wallets"])
    for m in c.meta["mixer"]:
        pat("Mixer / tumbler usage", "Critical", 0.95,
            f"{m['amount']:,} {c.token} sent into {m['name']}; outputs linked probabilistically by amount and timing.",
            [m["address"]])
    for b in c.meta["bridge"]:
        pat("Cross-chain bridge hop", "High", 0.86,
            f"Funds moved from {NETWORKS[b['from_network']]['name']} to {NETWORKS[b['to_network']]['name']} through {b['name']}.",
            [a for a, n in nodes.items() if n["role"] == "bridge"])
    if "rapid" in c.flags:
        pat("Rapid layering (high velocity)", "High", 0.84,
            "Median time between hops is under 30 minutes, consistent with scripted or automated movement.", first_hop)
    if "fan_in" in c.flags:
        srcs = [a for a, n in nodes.items() if n["role"] == "inbound"]
        pat("Fan-in from unrelated sources", "Medium", 0.78,
            f"{len(srcs)} other wallets paid into the reported wallet in the same window - possible additional victims.", srcs)
    for cons in c.meta["consolidation"]:
        pat("Consolidation before cash-out", "Medium", 0.82,
            "Multiple layering branches re-merge into one wallet shortly before reaching an exchange.", [cons])
    if "dusting" in c.flags:
        pat("Dusting activity", "Low", 0.65, "Tiny-value transfers received from a single source - possible address probing.",
            [a for a, n in nodes.items() if n["role"] == "dust"])
    if "held" in c.flags:
        pat("Funds dormant in layering wallets", "Medium", 0.8,
            "No exchange deposit observed yet; funds are sitting in layering wallets. Recommend adding to watchlist.", first_hop)

    # ---- clusters ----------------------------------------------------------
    clusters = []
    btc = c.net == "BTC"
    clusters.append(dict(id=f"CL-{c.cid[-4:]}-A", name="Operator distribution cluster",
                         heuristic="Common-input ownership" if btc else "Common funding source + temporal co-spending",
                         confidence=0.87 if btc else 0.79, wallets=[susp] + first_hop))
    if c.meta["peel_wallets"]:
        clusters.append(dict(id=f"CL-{c.cid[-4:]}-B", name="Peel-chain cluster", heuristic="Peel-chain change-address linkage",
                             confidence=0.83, wallets=[w for w in c.meta["peel_wallets"] if "change" in nodes[w]["label"]]))
    if c.meta["consolidation"]:
        cons = c.meta["consolidation"]
        feeders = sorted({t["from_address"] for t in c.txs if t["to_address"] in cons})
        clusters.append(dict(id=c.syndicate["cluster_id"] if c.syndicate else f"CL-{c.cid[-4:]}-C",
                             name=f"Cash-out cluster{' - ' + c.syndicate['name'] if c.syndicate else ''}",
                             heuristic="Consolidation + exchange deposit-address reuse", confidence=0.81,
                             wallets=cons + feeders))
    for cl in clusters:
        for w in cl["wallets"]:
            nodes[w].setdefault("cluster_id", cl["id"])

    # ---- risk score (mock XGBoost output with feature contributions) --------
    feats = [("Victim complaint on record (NCRP)", 18)]
    if mixer_used: feats.append(("Mixer / tumbler interaction", 17))
    if c.meta["peel_steps"]: feats.append(("Peel-chain structure", 10))
    if "rapid" in c.flags: feats.append(("High-velocity layering (<30 min/hop)", 11))
    if len(first_hop) >= 3: feats.append(("Fan-out to 3+ fresh wallets", 8))
    if "fan_in" in c.flags: feats.append(("Inflows from multiple unrelated sources", 9))
    if c.meta["bridge"]: feats.append(("Cross-chain bridge hop", 7))
    if nearest and not nearest["fiu_ind_registered"]: feats.append(("Cash-out via offshore / unregistered VASP", 10))
    if c.syndicate: feats.append(("Wallet linked to a known syndicate cluster", 12))
    feats.append(("Newly created wallets (<7 days old)", R.randint(4, 9)))
    feats.append(("Transaction amount profile", R.randint(2, 8)))
    score = min(99, sum(v for _, v in feats) + R.randint(-3, 3))
    level = "Critical" if score >= 80 else "High" if score >= 60 else "Medium" if score >= 40 else "Low"
    risk = dict(score=score, level=level, model="XGBoost v0.3 (demo)",
                factors=[dict(feature=f, contribution=v) for f, v in sorted(feats, key=lambda x: -x[1])])
    return dict(attributions=attributions, nearest=nearest, patterns=pats, clusters=clusters, risk=risk,
                pool_inr=pool_inr, traced_to_vasp_inr=traced_to_vasp, held_inr=held_inr)


# --------------------------------------------------------------------------- #
# Build everything
# --------------------------------------------------------------------------- #
STATUS_FLOW = ["New", "Tracing", "Exchange Identified", "Notice Sent", "KYC Received", "Closed"]


def status_for(days_ago, has_exchange):
    if not has_exchange:
        return "Tracing" if days_ago < 5 else "Monitoring"
    if days_ago <= 1: return R.choice(["New", "Tracing"])
    if days_ago <= 6: return R.choice(["Tracing", "Exchange Identified", "Exchange Identified"])
    if days_ago <= 18: return R.choice(["Exchange Identified", "Notice Sent", "Notice Sent"])
    if days_ago <= 40: return R.choice(["Notice Sent", "KYC Received", "KYC Received"])
    return R.choice(["KYC Received", "Closed", "Closed"])


cases, case_details, all_txs = [], [], []
wallet_agg = {}
for idx in range(ARGS.cases):
    c, info = build_case(idx)

    # place the case in time: complaint filed `days_ago` days before NOW
    days_ago = min(150, int(R.expovariate(1 / 28)))
    reported_at = NOW - timedelta(days=days_ago, hours=R.randint(0, 20), minutes=R.randint(0, 59))
    shift = (reported_at - timedelta(hours=R.randint(2, 96))) - info["last_pay"]
    for t in c.txs:
        t["_ts"] += shift
    overflow = max(t["_ts"] for t in c.txs) - (NOW - timedelta(minutes=40))
    if overflow > timedelta(0):
        for t in c.txs:
            t["_ts"] -= overflow
        reported_at -= overflow
        days_ago = (NOW - reported_at).days
    info["first_pay"] += shift
    info["last_pay"] += shift

    A = analyse(c, info)
    inv = R.choice(INVESTIGATORS)
    state = inv["state"] if inv["state"] and R.random() < 0.85 else R.choice(list(STATES))
    scode, districts = STATES[state]
    victim_name = f"{R.choice(FIRST)} {R.choice(LAST)}"
    status = status_for(days_ago, A["nearest"] is not None)
    si = STATUS_FLOW.index(status) if status in STATUS_FLOW else 1
    nearest = A["nearest"]
    amount_inr = info["amount_inr"]
    priority = "P1" if A["risk"]["score"] >= 80 or amount_inr >= 2_500_000 else "P2" if A["risk"]["score"] >= 60 or amount_inr >= 500_000 else "P3"
    ncrp = f"{R.choice('123')}{scode:02d}{reported_at:%d%m%y}{R.randint(10000, 99999)}"

    # timeline + notice + (masked) KYC response
    created = reported_at + timedelta(hours=R.randint(1, 30))
    created = min(created, NOW - timedelta(minutes=30))
    tl = [dict(at=iso(info["first_pay"]), event="First payment by complainant to suspect wallet"),
          dict(at=iso(reported_at), event=f"Complaint filed on NCRP (Ack. {ncrp})"),
          dict(at=iso(created), event=f"Case opened in RAAZ by {inv['name']}")]
    notice = kyc = None
    frozen = 0
    if si >= 1:
        tl.append(dict(at=iso(min(NOW, created + timedelta(minutes=R.randint(3, 12)))), event="Automated multi-hop trace completed"))
    if nearest and si >= 2:
        tl.append(dict(at=iso(min(NOW, created + timedelta(minutes=R.randint(15, 40)))),
                       event=f"Nearest VASP identified: {nearest['exchange']} ({nearest['hops']} hops, {int(nearest['confidence']*100)}% confidence)"))
    if nearest and si >= 3:
        sent = min(NOW - timedelta(hours=2), created + timedelta(days=R.randint(1, 4)))
        ex = EX_BY_ID[nearest["exchange_id"]]
        notice = dict(ref=f"RAAZ/NTC/2026/{idx + 101:04d}", exchange=nearest["exchange"], exchange_id=nearest["exchange_id"],
                      sent_on=iso(sent), legal_basis="Section 94 BNSS, 2023 (production of documents) + request to freeze under Sec. 106 BNSS",
                      deposit_addresses=nearest["deposit_addresses"], freeze_requested_inr=nearest["victim_attributable_inr"],
                      status="Awaiting response" if si == 3 else "Responded")
        tl.append(dict(at=iso(sent), event=f"Notice {notice['ref']} sent to {nearest['exchange']}"))
        if si >= 4:
            coop = {"High": (0.4, 0.85), "Medium": (0.15, 0.5), "Low": (0.0, 0.15)}[ex["cooperation"]]
            frozen = int(nearest["victim_attributable_inr"] * R.uniform(*coop))
            resp_at = min(NOW - timedelta(hours=1), sent + timedelta(days=R.randint(2, 20)))
            kyc = dict(received_on=iso(resp_at),
                       account_holder=f"{R.choice(FIRST)[0]}**** {R.choice(LAST)[0]}****",
                       registered_mobile=masked_phone(), email=f"{R.choice('abcdefghkmrs')}*****{R.randint(10, 99)}@mail.example",
                       pan=f"{''.join(R.choice('ABCDEFGHJKLMNPQRSTUVWXYZ') for _ in range(3))}P*****{R.choice('ABCDEFGHJK')}",
                       kyc_country="India" if R.random() < 0.7 else R.choice(["Cambodia", "UAE", "Myanmar", "Philippines"]),
                       account_created=iso(info["first_pay"] - timedelta(days=R.randint(5, 120))),
                       login_ips=[f"203.0.113.{R.randint(2, 254)}", f"198.51.100.{R.randint(2, 254)}"],
                       linked_bank=f"Bank A/c ending {R.randint(1000, 9999)}" if R.random() < 0.6 else "None on record",
                       funds_frozen_inr=frozen)
            tl.append(dict(at=iso(resp_at), event=f"KYC details received; INR {frozen:,} frozen at {nearest['exchange']}"))
        if si >= 5:
            tl.append(dict(at=iso(min(NOW, resp_at + timedelta(days=R.randint(5, 30)))), event="Case closed - refund of frozen amount ordered by court"))
    tl.sort(key=lambda e: e["at"])

    case = dict(
        id=c.cid, ncrp_ack=ncrp, title=f"{info['fraud']} - {districts[0] if len(districts) == 1 else R.choice(districts)}",
        fraud_type=info["fraud"], description=FRAUD_DESC[info["fraud"]],
        victim=dict(name=victim_name, age=R.randint(22, 71), phone=masked_phone()), state=state,
        district=R.choice(districts), reported_at=iso(reported_at), created_at=iso(created),
        network=c.net, token=c.token, reported_wallet=[a for a, n in c.nodes.items() if n["role"] == "suspect"][0],
        victim_wallet=[a for a, n in c.nodes.items() if n["role"] == "victim"][0],
        amount_lost_inr=amount_inr, amount_lost_token=rnd(c.token, amount_inr / PRICE_INR[c.token]), payments=info["n_pay"],
        status=status, priority=priority, risk_score=A["risk"]["score"], risk_level=A["risk"]["level"],
        investigator_id=inv["id"], investigator=inv["name"],
        nearest_exchange=nearest["exchange"] if nearest else None, nearest_exchange_id=nearest["exchange_id"] if nearest else None,
        exchange_confidence=nearest["confidence"] if nearest else None, hops_to_exchange=nearest["hops"] if nearest else None,
        traced_to_vasp_inr=A["traced_to_vasp_inr"], held_in_wallets_inr=A["held_inr"], frozen_inr=frozen,
        wallets_traced=len(c.nodes), transactions_traced=len(c.txs),
        patterns=list(dict.fromkeys(p["type"] for p in A["patterns"])), syndicate=c.syndicate["name"] if c.syndicate else None,
        linked_cases=[],
    )
    cases.append(case)

    # per-case detail document (what GET /api/cases/{id} would return)
    node_list = []
    for n in c.nodes.values():
        node_list.append(dict(n, first_seen=iso(n["first_seen"]) if n["first_seen"] else None,
                              last_seen=iso(n["last_seen"]) if n["last_seen"] else None))
    edges = []
    for t in c.txs:
        t["timestamp"] = iso(t["_ts"])
        t["block"] = block_at(t["network"], t["_ts"])
        edges.append({k: v for k, v in t.items() if k != "_ts"})
    edges.sort(key=lambda e: e["timestamp"])
    case_details.append(dict(case=case, nodes=node_list, transactions=edges, attributions=A["attributions"],
                             patterns=A["patterns"], clusters=A["clusters"], risk=A["risk"], timeline=tl,
                             notice=notice, kyc_response=kyc, pool_inr=A["pool_inr"],
                             investigator=inv))
    all_txs += edges

    # global wallet aggregation
    for n in node_list:
        w = wallet_agg.setdefault(n["address"], dict(address=n["address"], network=n["network"], role=n["role"], label=n["label"],
                                                     entity=n["entity"], exchange_id=n["exchange_id"], cases=[], cluster_id=n.get("cluster_id"),
                                                     in_inr=0, out_inr=0, tx_count=0, first_seen=n["first_seen"], last_seen=n["last_seen"],
                                                     balance=n["balance"], token=c.token, risk_score=0))
        if ROLE_PRIORITY.index(n["role"]) < ROLE_PRIORITY.index(w["role"]):
            w.update(role=n["role"], label=n["label"])
        w["cases"].append(c.cid)
        w["in_inr"] += n["in_inr"]
        w["out_inr"] += n["out_inr"]
        w["tx_count"] += n["tx_count"]
        if n["first_seen"]: w["first_seen"] = min(filter(None, [w["first_seen"], n["first_seen"]]))
        if n["last_seen"]: w["last_seen"] = max(filter(None, [w["last_seen"], n["last_seen"]]))
        w["cluster_id"] = w["cluster_id"] or n.get("cluster_id")
        base = {"suspect": A["risk"]["score"], "consolidation": min(99, A["risk"]["score"] + 5), "intermediary": A["risk"]["score"] - R.randint(5, 20),
                "mixer": 96, "bridge": 38, "exchange_deposit": A["risk"]["score"] - R.randint(10, 25), "exchange_hot": R.randint(12, 25),
                "inbound": R.randint(20, 45), "dust": R.randint(35, 55), "victim": R.randint(2, 8)}[n["role"]]
        w["risk_score"] = max(w["risk_score"], max(1, min(99, base)))

# cross-case linkage through syndicate clusters
for s in SYNDICATES:
    for cid in s["cases"]:
        case = next(x for x in cases if x["id"] == cid)
        case["linked_cases"] = [x for x in s["cases"] if x != cid]
for d in case_details:
    d["case"] = next(x for x in cases if x["id"] == d["case"]["id"])
    if d["case"]["linked_cases"]:
        d["patterns"].append(dict(type="Cross-case linkage", severity="Critical", confidence=0.9,
                                  description=f"Consolidation wallet also appears in {len(d['case']['linked_cases'])} other RAAZ case(s): "
                                              f"{', '.join(d['case']['linked_cases'])}. Likely the same operator ({d['case']['syndicate']}).",
                                  wallets=[s["address"] for s in SYNDICATES if s["name"] == d["case"]["syndicate"]]))
        d["case"]["patterns"].append("Cross-case linkage")

# exchanges directory with computed linkage
exchanges_out = []
for e in EXCHANGES:
    linked = [d for d in case_details if any(a["exchange_id"] == e["id"] for a in d["attributions"])]
    exchanges_out.append(dict({k: v for k, v in e.items() if k != "weight"},
                              hot_wallets=[dict(network=n, address=HOT[(e["id"], n)]) for n in e["networks"]],
                              known_deposit_addresses=sum(len(a["deposit_addresses"]) for d in linked for a in d["attributions"] if a["exchange_id"] == e["id"]),
                              cases_linked=len(linked),
                              total_inr_received=sum(a["amount_inr"] for d in linked for a in d["attributions"] if a["exchange_id"] == e["id"]),
                              notices_sent=sum(1 for d in linked if d["notice"] and d["notice"]["exchange_id"] == e["id"]),
                              notices_responded=sum(1 for d in linked if d["notice"] and d["notice"]["exchange_id"] == e["id"] and d["notice"]["status"] == "Responded")))

# watchlist + alerts
active = [x for x in cases if x["status"] not in ("Closed",)]
watch_cases = R.sample(active, min(16, len(active)))
watchlist = []
for x in watch_cases:
    w = wallet_agg[x["reported_wallet"]]
    watchlist.append(dict(address=x["reported_wallet"], network=x["network"], case_id=x["id"], label="Reported suspect wallet",
                          reason=f"Suspect wallet in {x['fraud_type']}", added_by=x["investigator"], added_on=x["created_at"],
                          risk_score=w["risk_score"], balance=w["balance"], token=x["token"], status="Active"))
for s in SYNDICATES:
    if s["address"] in wallet_agg:
        w = wallet_agg[s["address"]]
        watchlist.append(dict(address=s["address"], network=s["network"], case_id=s["cases"][0], label=f"Consolidation wallet ({s['name']})",
                              reason=f"Shared across {len(s['cases'])} cases - syndicate cash-out hub", added_by="Ananya Sharma",
                              added_on=w["first_seen"], risk_score=w["risk_score"], balance=w["balance"], token=w["token"], status="Active"))

ALERT_TYPES = [
    ("OUTBOUND_TRANSFER", "High", "Watched wallet moved {amt} {tok} to a new address"),
    ("EXCHANGE_DEPOSIT", "Critical", "Funds from watched wallet reached {ex} deposit address in {h} hops"),
    ("NEW_INBOUND", "High", "New inbound of {amt} {tok} to watched wallet - possible new victim"),
    ("MIXER_INTERACTION", "Critical", "Watched wallet interacted with Obscura Mixer"),
    ("NOTICE_RESPONSE", "Info", "{ex} acknowledged notice and marked account for review"),
    ("DORMANT_REACTIVATED", "Medium", "Wallet dormant for {d} days became active again"),
]
alerts = []
for i in range(26):
    wl = R.choice(watchlist)
    atype, sev, tpl = R.choice(ALERT_TYPES)
    if atype == "MIXER_INTERACTION" and wl["network"] not in ("ETH", "BSC", "BTC"):
        atype, sev, tpl = ALERT_TYPES[0]
    tok = wl["token"]
    amt = rnd(tok, (R.uniform(500, 25000) if tok in ("USDT", "USDC", "POL") else R.uniform(0.05, 3)))
    ex = R.choice([e for e in EXCHANGES if wl["network"] in e["networks"]])["name"]
    at = NOW - timedelta(minutes=int(R.expovariate(1 / 1800)))
    alerts.append(dict(id=f"ALT-{9000 + i}", type=atype, severity=sev, case_id=wl["case_id"], address=wl["address"], network=wl["network"],
                       message=tpl.format(amt=f"{amt:,}", tok=tok, ex=ex, h=R.randint(1, 4), d=R.randint(12, 60)),
                       tx_hash=new_hash(wl["network"]) if atype != "NOTICE_RESPONSE" else None, at=iso(at), read=R.random() < 0.45))
alerts.sort(key=lambda a: a["at"], reverse=True)

# national-level daily stats (dashboard trend)
daily = []
for d in range(90, 0, -1):
    day = NOW - timedelta(days=d)
    wk = 0.82 if day.weekday() >= 5 else 1.0
    trend = 1 + (90 - d) * 0.004
    daily.append(dict(date=day.strftime("%Y-%m-%d"),
                      complaints=int(R.gauss(410, 45) * wk * trend),
                      wallets_traced=int(R.gauss(2600, 300) * wk * trend),
                      vasps_identified=int(R.gauss(190, 25) * wk * trend),
                      amount_traced_cr=round(R.gauss(9.5, 1.8) * wk * trend, 2)))

samples = []
for net in ["TRON", "ETH", "BTC", "BSC", "POLYGON"]:
    x = next((x for x in cases if x["network"] == net and x["nearest_exchange"]), None)
    if x:
        samples.append(dict(network=net, address=x["reported_wallet"], case_id=x["id"], label=f"{x['fraud_type']} ({x['id']})"))

wallets = sorted(wallet_agg.values(), key=lambda w: -w["risk_score"])
meta = dict(project="RAAZ - Automated Anti-Fraud Analysis", problem_statement="SIH26183", generated_at=iso(NOW), seed=ARGS.seed,
            disclaimer="DEMO DATA. All wallet addresses and transaction hashes are randomly generated. All exchange, mixer, bridge, person and "
                       "organisation names are fictional. Any resemblance to real entities is coincidental.",
            prices_inr=PRICE_INR, networks={k: v["name"] for k, v in NETWORKS.items()},
            counts=dict(cases=len(cases), wallets=len(wallets), transactions=len(all_txs), exchanges=len(exchanges_out),
                        alerts=len(alerts), watchlist=len(watchlist)),
            current_user="INV01", syndicates=[dict(id=s["id"], name=s["name"], network=s["network"], address=s["address"], cases=s["cases"]) for s in SYNDICATES])

# --------------------------------------------------------------------------- #
# Write
# --------------------------------------------------------------------------- #
os.makedirs(OUT_CASES, exist_ok=True)
os.makedirs(OUT_CSV, exist_ok=True)
for f in os.listdir(OUT_CASES):
    os.remove(os.path.join(OUT_CASES, f))


def dump(name, obj):
    with open(os.path.join(OUT_JSON, name), "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))


dump("meta.json", meta)
dump("cases.json", cases)
dump("wallets.json", wallets)
dump("transactions.json", all_txs)
dump("exchanges.json", exchanges_out)
dump("alerts.json", alerts)
dump("watchlist.json", watchlist)
dump("investigators.json", INVESTIGATORS)
dump("daily_stats.json", daily)
dump("samples.json", samples)
for d in case_details:
    with open(os.path.join(OUT_CASES, f"{d['case']['id']}.json"), "w", encoding="utf-8") as fh:
        json.dump(d, fh, ensure_ascii=False, separators=(",", ":"))


def write_csv(name, rows, cols):
    with open(os.path.join(OUT_CSV, name), "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: (";".join(map(str, v)) if isinstance(v, list) else v) for k, v in r.items()})


write_csv("cases.csv", [dict(c, victim_name=c["victim"]["name"]) for c in cases],
          ["id", "ncrp_ack", "fraud_type", "victim_name", "state", "district", "reported_at", "network", "token", "reported_wallet",
           "amount_lost_inr", "amount_lost_token", "status", "priority", "risk_score", "risk_level", "investigator", "nearest_exchange",
           "exchange_confidence", "hops_to_exchange", "traced_to_vasp_inr", "held_in_wallets_inr", "frozen_inr", "wallets_traced",
           "transactions_traced", "patterns", "syndicate", "linked_cases"])
write_csv("wallets.csv", wallets, ["address", "network", "role", "label", "entity", "cluster_id", "risk_score", "cases", "in_inr", "out_inr",
                                   "tx_count", "balance", "token", "first_seen", "last_seen"])
write_csv("transactions.csv", all_txs, ["id", "hash", "case_id", "network", "block", "timestamp", "from_address", "to_address", "amount",
                                        "token", "value_inr", "kind", "hop", "inferred"])
write_csv("exchanges.csv", exchanges_out, ["id", "name", "type", "jurisdiction", "fiu_ind_registered", "kyc_level", "cooperation",
                                           "avg_response_days", "networks", "cases_linked", "total_inr_received", "known_deposit_addresses",
                                           "notices_sent", "notices_responded", "compliance_contact"])
write_csv("patterns.csv", [dict(p, case_id=d["case"]["id"]) for d in case_details for p in d["patterns"]],
          ["case_id", "type", "severity", "confidence", "description", "wallets"])
write_csv("alerts.csv", alerts, ["id", "at", "type", "severity", "case_id", "network", "address", "message", "tx_hash", "read"])
write_csv("watchlist.csv", watchlist, ["address", "network", "case_id", "label", "reason", "added_by", "added_on", "risk_score", "balance", "token", "status"])
write_csv("investigators.csv", INVESTIGATORS, ["id", "name", "rank", "unit", "badge"])

print(json.dumps(meta["counts"]))
print("status mix:", {s: sum(1 for c in cases if c["status"] == s) for s in STATUS_FLOW + ["Monitoring"]})
print("network mix:", {n: sum(1 for c in cases if c["network"] == n) for n in NETWORKS})
print("syndicates:", [(s["name"], s["cases"]) for s in SYNDICATES])
