import fetch from 'node-fetch'

// TfNSW Open Data Hub — Live Traffic Hazards API (NSW only)
// Requires a free API key from https://opendata.transport.nsw.gov.au — set as TRANSPORT_NSW_KEY
const BASE_URL    = 'https://api.transport.nsw.gov.au/v1/live/hazards'
const CATEGORIES  = ['incident', 'roadwork']
const POLL_MS     = 5 * 60 * 1000

function parseFeature(feature, category) {
  const p          = feature.properties ?? {}
  const [lon, lat] = feature.geometry?.coordinates ?? []
  return {
    id:          p.id ?? feature.id ?? `${category}-${lat}-${lon}`,
    category,
    title:       p.title ?? p.description ?? 'Road hazard',
    description: p.description ?? '',
    advice:      p.advice ?? '',
    road:        p.road ?? '',
    suburb:      p.suburb ?? '',
    impact:      p.impact ?? 'unknown',
    closure:     Boolean(p.closure),
    created:     p.created ?? null,
    updated:     p.last_updated ?? null,
    end:         p.end ?? null,
    lat,
    lon,
  }
}

async function fetchCategory(category, key) {
  const res = await fetch(`${BASE_URL}/${category}/open`, {
    headers: { Authorization: `apikey ${key}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`TfNSW ${category} HTTP ${res.status}`)
  const json     = await res.json()
  const features = json.features ?? (Array.isArray(json) ? json : [])
  return features
    .map(f => parseFeature(f, category))
    .filter(h => h.lat != null && h.lon != null)
}

export function startRoadClosuresPoller(broadcast, store) {
  async function poll() {
    const key = process.env.TRANSPORT_NSW_KEY
    if (!key) {
      console.warn('[ROAD CLOSURES] TRANSPORT_NSW_KEY not set — road closures layer disabled')
      return
    }

    const results = await Promise.allSettled(CATEGORIES.map(c => fetchCategory(c, key)))
    const hazards = results.flatMap((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[ROAD CLOSURES] ${CATEGORIES[i]} failed:`, r.reason.message)
        return []
      }
      return r.value
    })

    if (results.some(r => r.status === 'fulfilled')) {
      store.roadClosures = hazards
      broadcast('road_closures', hazards)
      console.log(`[ROAD CLOSURES] ${hazards.length} active NSW hazards (${hazards.filter(h => h.closure).length} closures)`)
    }
  }

  poll()
  setInterval(poll, POLL_MS)
}
