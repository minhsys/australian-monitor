import fetch from 'node-fetch'

// Free tier: 1,000 req/month → stagger polls, 30min interval
const POLL_MS = 30 * 60 * 1000

const AIRPORTS = [
  { iata: 'SYD', name: 'Sydney Kingsford Smith' },
  { iata: 'MEL', name: 'Melbourne Tullamarine' },
  { iata: 'BNE', name: 'Brisbane' },
  { iata: 'PER', name: 'Perth' },
  { iata: 'DRW', name: 'Darwin' },
  { iata: 'ADL', name: 'Adelaide' },
  { iata: 'HBA', name: 'Hobart' },
  { iata: 'CNS', name: 'Cairns' },
]

function buildUrl(iata, key) {
  return `https://airlabs.co/api/v9/schedules?dep_iata=${iata}&api_key=${key}`
}

function summarise(flights, iata, name) {
  // dep_time_utc is "HH:MM" time-only — count all flights in the schedule response
  const all = flights || []
  return {
    iata,
    name,
    departures: all.length,
    delayed:    all.filter(f => (f.delayed ?? 0) > 15).length,
    updatedAt:  new Date().toISOString(),
  }
}

export function startFidsPoller(broadcast, store) {
  const key = process.env.AIRLABS_KEY
  if (!key) {
    console.warn('[FIDS] AIRLABS_KEY not set — FIDS disabled')
    return
  }

  async function pollAirport(airport) {
    try {
      const res = await fetch(buildUrl(airport.iata, key), {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error(`AirLabs HTTP ${res.status}`)
      const data    = await res.json()
      const summary = summarise(data.response, airport.iata, airport.name)

      store.fids = { ...(store.fids ?? {}), [airport.iata]: summary }
      broadcast('fids', store.fids)
      console.log(`[FIDS] ${airport.iata}: ${summary.departures} deps, ${summary.delayed} delayed`)
    } catch (err) {
      console.warn(`[FIDS] ${airport.iata} failed:`, err.message)
    }
  }

  // Stagger by 2s per airport to avoid burst
  AIRPORTS.forEach((airport, i) => {
    setTimeout(() => {
      pollAirport(airport)
      setInterval(() => pollAirport(airport), POLL_MS)
    }, i * 2_000)
  })
}
