import fetch from 'node-fetch'

// AEMO NEM Market Notices — public directory of plain-text notice files, no API key.
// Most notices are routine (price confirmations); only outage/supply-risk ones are kept.
const NEM_ORIGIN     = 'https://nemweb.com.au'
const NEM_NOTICE_DIR = `${NEM_ORIGIN}/Reports/Current/Market_Notice/`

// AEMO East Coast Gas System notices — public CSV, no API key.
const ECGS_NOTICE_CSV = 'https://www.nemweb.com.au/Reports/CURRENT/ECGS/ECGS_Notices/int929a_v4_system_notices_1.csv'

const ELECTRICITY_POLL_MS  = 5 * 60 * 1000
const GAS_POLL_MS          = 30 * 60 * 1000
const MAX_FETCH_PER_POLL   = 25
const MAX_SEEN_FILES       = 3000
const MAX_NOTICES_KEPT     = 30

// Most market notices are routine ("Prices Unchanged", dispatch interval confirmations).
// Only narrative text matching this is treated as an electricity supply-risk signal.
const OUTAGE_RELEVANT_RE = /lack of reserve|\bLOR ?[123]\b|power system (incident|event)|involuntary load shed|load shedding|market suspension|non-conformance|force majeure|directions? notice|system security|generator (trip|forced outage)|under-?frequency/i

function extractNoticeFiles(html) {
  const matches = [...html.matchAll(/href="([^"]*MKTNOTICE[^"]+)"/gi)]
  return [...new Set(matches.map(m => m[1]).filter(Boolean))]
}

function parseNoticeText(text) {
  // AEMO pads field names with spaces before the colon, e.g. "Notice ID               :   144322"
  const field = name => text.match(new RegExp(`${name}\\s*:\\s*(.+)`, 'i'))?.[1]?.trim()
  return {
    id:     field('Notice ID'),
    type:   field('Notice Type ID'),
    issued: field('Issue Date'),
    reason: text.split(/Reason\s*:/i)[1]?.trim() ?? '',
  }
}

async function fetchNewElectricityNotices(seenFiles) {
  const res = await fetch(NEM_NOTICE_DIR, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`NEMWeb directory HTTP ${res.status}`)
  const html  = await res.text()
  const files = extractNoticeFiles(html)

  const unseen  = files.filter(f => !seenFiles.has(f))
  const toFetch = unseen.slice(-MAX_FETCH_PER_POLL)
  files.forEach(f => seenFiles.add(f))

  const fetched = await Promise.allSettled(
    toFetch.map(async f => {
      const r = await fetch(`${NEM_ORIGIN}${f}`, { signal: AbortSignal.timeout(10_000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return { file: f, text: await r.text() }
    })
  )

  const notices = []
  for (const result of fetched) {
    if (result.status !== 'fulfilled') continue
    const parsed   = parseNoticeText(result.value.text)
    const combined = `${parsed.type ?? ''} ${parsed.reason ?? ''}`
    if (OUTAGE_RELEVANT_RE.test(combined)) {
      notices.push({
        id:     parsed.id ?? result.value.file,
        type:   parsed.type ?? 'NOTICE',
        issued: parsed.issued,
        label:  (parsed.reason || parsed.type || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      })
    }
  }
  return notices
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

async function fetchGasNotices() {
  const res = await fetch(ECGS_NOTICE_CSV, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`ECGS CSV HTTP ${res.status}`)
  const text  = await res.text()
  const lines = text.trim().split('\n').slice(1) // skip header

  return lines
    .map(parseCsvLine)
    .filter(r => r[0])
    .map(r => ({
      id:       r[0],
      critical: r[1] === 'Y',
      message:  r[2],
      start:    r[4] || null,
      end:      r[5] || null,
      url:      r[6] ? `https://www.nemweb.com.au${r[6]}` : null,
    }))
}

export function startEnergyOutagesPoller(broadcast, store) {
  const seenFiles = new Set()

  function trimSeenFiles() {
    if (seenFiles.size <= MAX_SEEN_FILES) return
    const excess = seenFiles.size - MAX_SEEN_FILES
    let i = 0
    for (const f of seenFiles) {
      if (i++ >= excess) break
      seenFiles.delete(f)
    }
  }

  async function pollElectricity() {
    try {
      const notices = await fetchNewElectricityNotices(seenFiles)
      trimSeenFiles()
      if (notices.length) {
        const merged = [...notices, ...(store.energyOutages?.electricity ?? [])].slice(0, MAX_NOTICES_KEPT)
        store.energyOutages = { ...(store.energyOutages ?? {}), electricity: merged }
        broadcast('energy_outages', store.energyOutages)
        console.log(`[ENERGY OUTAGES] ${notices.length} new electricity supply-risk notice(s)`)
      }
    } catch (err) {
      console.warn('[ENERGY OUTAGES] Electricity poll failed:', err.message)
    }
  }

  async function pollGas() {
    try {
      const notices = await fetchGasNotices()
      store.energyOutages = { ...(store.energyOutages ?? {}), gas: notices.slice(-MAX_NOTICES_KEPT).reverse() }
      broadcast('energy_outages', store.energyOutages)
      console.log(`[ENERGY OUTAGES] ${notices.length} east coast gas system notice(s) (${notices.filter(n => n.critical).length} critical)`)
    } catch (err) {
      console.warn('[ENERGY OUTAGES] Gas poll failed:', err.message)
    }
  }

  pollElectricity()
  pollGas()
  setInterval(pollElectricity, ELECTRICITY_POLL_MS)
  setInterval(pollGas, GAS_POLL_MS)
}
