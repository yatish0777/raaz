// Report helpers: grounded facts -> LLM prompt, plus an offline template narrative.
// The LLM only writes prose; every number in the report tables comes from the trace itself.

import { inrShort, inr, dateOnly, NETWORKS } from './format'

export function buildFacts(d, exchanges = []) {
  const c = d.case
  const ex = (id) => exchanges.find((e) => e.id === id)
  const hops = d.transactions.reduce((m, t) => Math.max(m, t.hop ?? 0), 0)
  return {
    case_id: c.id,
    ncrp_ack: c.ncrp_ack,
    fraud_type: c.fraud_type,
    complaint_summary: c.description,
    location: `${c.district}, ${c.state}`,
    reported_on: dateOnly(c.reported_at),
    network: NETWORKS[c.network]?.name ?? c.network,
    token: c.token,
    amount_lost: inr(c.amount_lost_inr),
    victim_payments: c.payments,
    reported_wallet: c.reported_wallet,
    wallets_traced: c.wallets_traced,
    transactions_traced: c.transactions_traced,
    max_hop_depth: hops,
    total_inflow_to_reported_wallet: inr(d.pool_inr),
    traced_to_exchanges: inr(c.traced_to_vasp_inr),
    held_in_wallets: inr(c.held_in_wallets_inr),
    risk: `${d.risk.score}/100 (${d.risk.level})`,
    top_risk_factors: d.risk.factors.slice(0, 5).map((f) => f.feature),
    patterns: d.patterns.map((p) => `${p.type} [${p.severity}]: ${p.description}`),
    exchanges: d.attributions.map((a) => ({
      name: a.exchange, jurisdiction: a.jurisdiction, fiu_ind_registered: a.fiu_ind_registered, hops: a.hops,
      amount_received: inr(a.amount_inr), victim_share_pro_rata: inr(a.victim_attributable_inr),
      confidence: `${Math.round(a.confidence * 100)}%`, deposit_addresses: a.deposit_addresses,
      cooperation: ex(a.exchange_id)?.cooperation,
    })),
    nearest_exchange: d.attributions[0]?.exchange ?? null,
    linked_cases: c.linked_cases,
    syndicate: c.syndicate,
  }
}

export const SYSTEM_PROMPT = `You are a financial-crime analyst assisting Indian law-enforcement (cyber crime police / I4C).
Write in formal, precise English suitable for a case file. Use ONLY the facts provided in the JSON.
Never invent wallet addresses, amounts, names, dates or exchanges. If a fact is missing, say "not available".
Use Indian number formatting (lakh / crore) when restating amounts.`

export function buildPrompt(facts) {
  return `Case facts (JSON):
${JSON.stringify(facts, null, 2)}

Write the narrative sections of an investigation report with exactly these headings, each on its own line starting with "### ":
### Executive Summary
(one paragraph: what happened, how much, where the funds went, the nearest probable exchange)
### Modus Operandi and Fund-Flow Analysis
(one or two paragraphs explaining the laundering pattern hop by hop, referencing the detected patterns)
### Basis for Exchange Attribution
(one paragraph explaining why the funds are attributed to the exchange(s), with confidence and limitations)
### Recommended Next Steps
(4-6 bullet points starting with "- ", e.g. notice under Section 94 BNSS, freeze request, watchlist, linked cases)

Do not add any other headings. Do not repeat the JSON.`
}

export function templateNarrative(f) {
  const n = f.exchanges[0]
  const pats = f.patterns.map((p) => p.split(' [')[0].toLowerCase())
  const lines = []
  lines.push('### Executive Summary')
  lines.push(
    `On ${f.reported_on}, a complaint (NCRP Ack. ${f.ncrp_ack}) was registered from ${f.location} relating to ${f.fraud_type.toLowerCase()}. ` +
      `The complainant transferred ${f.amount_lost} in ${f.victim_payments} payment(s) of ${f.token} on the ${f.network} network to the reported wallet ${f.reported_wallet}. ` +
      `RAAZ traced ${f.wallets_traced} wallets and ${f.transactions_traced} transactions up to ${f.max_hop_depth} hops. ` +
      (n
        ? `${f.traced_to_exchanges} of the traced funds reached exchange-controlled deposit addresses; the nearest probable VASP is ${n.name} (${n.jurisdiction}) at ${n.hops} hops with ${n.confidence} attribution confidence.`
        : `No exchange deposit has been observed yet; ${f.held_in_wallets} remains in layering wallets.`),
  )
  lines.push('### Modus Operandi and Fund-Flow Analysis')
  lines.push(
    `The reported wallet received ${f.total_inflow_to_reported_wallet} in total, including inflows from other unattributed sources. ` +
      `Funds were then moved through a layering structure showing ${pats.length ? pats.join(', ') : 'simple forwarding'}. ` +
      `The overall risk score is ${f.risk}, driven mainly by: ${f.top_risk_factors.slice(0, 3).join('; ').toLowerCase()}.`,
  )
  if (f.syndicate) lines.push(`The consolidation wallet is shared with ${f.linked_cases.length} other case(s) (${f.linked_cases.join(', ')}), indicating the same operator group (${f.syndicate}).`)
  lines.push('### Basis for Exchange Attribution')
  lines.push(
    n
      ? `Attribution to ${n.name} is based on (i) the deposit address(es) ${n.deposit_addresses.join(', ')} being swept into a known ${n.name} hot wallet, and (ii) the per-user deposit-address pattern of the exchange. ` +
          `${n.name} received ${n.amount_received}, of which ${n.victim_share_pro_rata} is attributable to the complainant on a pro-rata basis. ` +
          `Attribution is probabilistic; confirmation must be obtained from the exchange's KYC and transaction records.`
      : 'Not available - no exchange deposit observed in the traced depth.',
  )
  lines.push('### Recommended Next Steps')
  if (n) {
    lines.push(`- Issue notice under Section 94 BNSS to ${n.name} for KYC, login IP and withdrawal records of the deposit address owner.`)
    lines.push(`- Request immediate debit freeze of ${n.victim_share_pro_rata} at ${n.name}.`)
  }
  lines.push('- Add the reported wallet and consolidation wallets to the RAAZ watchlist for real-time movement alerts.')
  if (f.syndicate) lines.push(`- Coordinate with investigating officers of linked cases ${f.linked_cases.join(', ')} for a joint operation.`)
  lines.push('- Preserve on-chain evidence (transaction hashes, block numbers) with hash-verified export for court submission.')
  lines.push('- Update the NCRP complaint with trace findings and exchange details.')
  return lines.join('\n')
}

export { inrShort }
