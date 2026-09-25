// Ollama (local LLM) client - used for AI-assisted report drafting.
// Runs fully on the investigator's machine / department server: case data never leaves the network.
// Docs: https://github.com/ollama/ollama/blob/main/docs/api.md

const LS_KEY = 'raaz.ollama'

export const DEFAULT_OLLAMA = {
  url: import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434',
  model: import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1:8b',
}

export function getOllamaConfig() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY))
    if (s?.url && s?.model) return s
  } catch { /* ignore */ }
  return { ...DEFAULT_OLLAMA }
}

export function setOllamaConfig(cfg) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)) } catch { /* ignore */ }
}

/** GET /api/tags - reachable + which models are pulled */
export async function checkOllama(cfg = getOllamaConfig()) {
  try {
    const r = await fetch(`${cfg.url.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(2500) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    const models = (j.models || []).map((m) => m.name)
    return { ok: true, models, hasModel: models.some((m) => m === cfg.model || m.split(':')[0] === cfg.model.split(':')[0]) }
  } catch (e) {
    return { ok: false, models: [], error: e.name === 'TimeoutError' ? 'timed out' : e.message }
  }
}

/** POST /api/generate (streaming NDJSON) - yields text chunks */
export async function* streamGenerate({ prompt, system, cfg = getOllamaConfig(), signal }) {
  const r = await fetch(`${cfg.url.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.model, prompt, system, stream: true, options: { temperature: 0.2, num_ctx: 8192 } }),
    signal,
  })
  if (!r.ok) throw new Error(`Ollama returned ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line) continue
      const j = JSON.parse(line)
      if (j.error) throw new Error(j.error)
      if (j.response) yield j.response
      if (j.done) return
    }
  }
}
