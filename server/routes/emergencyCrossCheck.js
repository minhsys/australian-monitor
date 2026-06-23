import fetch from 'node-fetch'

const EMERGENCYAPI_BASE = 'https://emergencyapi.com/api/v1/incidents'
const FETCH_TIMEOUT_MS  = 10_000
const POLL_MS           = 15 * 60 * 1000
const FIRST_POLL_MS      = 45_000
const DIFF_WARN_THRESHOLD = 2

// States where we already have a direct, official feed (server/routes/emergencyAlertSources.js).
// Cross-checking validates those feeds against EmergencyAPI's aggregation, it does not add new coverage.
const COVERED_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT']

// EmergencyAPI tags pager dispatch logs (*-PAGER) and fire-danger-rating-only feeds (*-FDR) under
// `source.agency` too — neither is a comparable "incident" in the sense our direct feeds report,
// so they're excluded rather than inflating/deflating the comparison.
const NOT_COMPARABLE_RE = /-PAGER$|-FDR$/i

export function isComparableFeature(feature) {
  const agency = feature?.properties?.source?.agency ?? ''
  return !NOT_COMPARABLE_RE.test(agency)
}

export function summarizeByAgency(features) {
  const counts = {}
  for (const f of features) {
    const agency = f?.properties?.source?.agency ?? 'unknown'
    counts[agency] = (counts[agency] ?? 0) + 1
  }
  return counts
}

export function compareState(stateCode, directCount, features) {
  const comparable = features.filter(isComparableFeature)
  const emergencyApiCount = comparable.length
  return {
    state: stateCode,
    directCount,
    emergencyApiCount,
    diff: directCount - emergencyApiCount,
    agencyBreakdown: summarizeByAgency(features), // includes non-comparable/extra agencies, for visibility only
  }
}

async function fetchEmergencyApiState(stateCode) {
  const key = process.env.EMERGENCYAPI_KEY
  if (!key) throw new Error('EMERGENCYAPI_KEY not set')
  const res = await fetch(`${EMERGENCYAPI_BASE}?state=${stateCode.toLowerCase()}&limit=200`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`EmergencyAPI HTTP ${res.status} — ${stateCode}`)
  const geojson = await res.json()
  return geojson.features ?? []
}

export async function runCrossCheck(emergencyAlerts) {
  const results = await Promise.allSettled(
    COVERED_STATES.map(async state => {
      const directCount = emergencyAlerts.filter(a => a.state === state).length
      const features     = await fetchEmergencyApiState(state)
      return compareState(state, directCount, features)
    })
  )

  const comparisons = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      comparisons.push(r.value)
      if (Math.abs(r.value.diff) >= DIFF_WARN_THRESHOLD) {
        console.warn(`[EMERGENCY CROSS-CHECK] ${r.value.state}: direct=${r.value.directCount} emergencyAPI=${r.value.emergencyApiCount} (diff ${r.value.diff})`)
      }
    } else {
      console.warn(`[EMERGENCY CROSS-CHECK] ${COVERED_STATES[i]} failed:`, r.reason?.message)
    }
  })

  return { comparisons, checkedAt: new Date().toISOString() }
}

export function startEmergencyCrossCheckPoller(broadcast, store) {
  async function poll() {
    if (!store.emergencyAlerts?.length) {
      setTimeout(poll, POLL_MS)
      return
    }
    try {
      const result = await runCrossCheck(store.emergencyAlerts)
      store.emergencyCrossCheck = result
      broadcast('emergency_cross_check', result)
      console.log(`[EMERGENCY CROSS-CHECK] Compared ${result.comparisons.length}/${COVERED_STATES.length} states against EmergencyAPI.com`)
    } catch (err) {
      console.warn('[EMERGENCY CROSS-CHECK] Poll failed:', err.message)
    }
    setTimeout(poll, POLL_MS)
  }

  setTimeout(poll, FIRST_POLL_MS)
}
