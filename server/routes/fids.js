import fetch from 'node-fetch'

const POLL_MS_AIRLABS  = 30 * 60 * 1000
const POLL_MS_FALLBACK =  5 * 60 * 1000

const AIRPORTS = [
  { iata: 'SYD', name: 'Kingsford Smith', lat: -33.94, lon: 151.18 },
  { iata: 'MEL', name: 'Tullamarine',     lat: -37.67, lon: 144.84 },
  { iata: 'BNE', name: 'Brisbane',        lat: -27.38, lon: 153.12 },
  { iata: 'PER', name: 'Perth',           lat: -31.94, lon: 115.97 },
  { iata: 'DRW', name: 'Darwin',          lat: -12.41, lon: 130.88 },
  { iata: 'ADL', name: 'Adelaide',        lat: -34.95, lon: 138.53 },
  { iata: 'CBR', name: 'Canberra',        lat: -35.31, lon: 149.19 },
  { iata: 'HBA', name: 'Hobart',          lat: -42.84, lon: 147.51 },
]

function distKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function deriveFromFlights(flights) {
  const now = new Date().toISOString()
  return Object.fromEntries(
    AIRPORTS.map(ap => {
      const nearby = (flights || []).filter(
        f => f.lat != null && f.lon != null && distKm(f.lat, f.lon, ap.lat, ap.lon) < 150
      )
      return [ap.iata, {
        iata: ap.iata, name: ap.name,
        departures: nearby.length,
        delayed:    null,
        source:     'opensky',
        updatedAt:  now,
      }]
    })
  )
}

function buildUrl(iata, key) {
  return `https://airlabs.co/api/v9/schedules?dep_iata=${iata}&api_key=${key}`
}

function summarise(flights, iata, name) {
  const all = flights || []
  return {
    iata, name,
    departures: all.length,
    delayed:    all.filter(f => (f.delayed ?? 0) > 15).length,
    source:     'airlabs',
    updatedAt:  new Date().toISOString(),
  }
}

function runOpenSkyFallback(broadcast, store) {
  // Fallback: derive TCA traffic from live OpenSky positions already in store.flights
  console.log('[FIDS] Using OpenSky live position fallback')
  function poll() {
    if (!store.flights?.length) return
    store.fids = deriveFromFlights(store.flights)
    broadcast('fids', store.fids)
    const total = Object.values(store.fids).reduce((s, a) => s + a.departures, 0)
    console.log(`[FIDS] Derived ${total} TCA movements from ${store.flights.length} live flights`)
  }
  setTimeout(poll, 15_000)  // wait for first OpenSky poll
  setInterval(poll, POLL_MS_FALLBACK)
}

export function startFidsPoller(broadcast, store) {
  const key = process.env.AIRLABS_KEY

  if (!key) {
    console.log('[FIDS] No AIRLABS_KEY — using OpenSky live position fallback')
    runOpenSkyFallback(broadcast, store)
    return
  }

  let quotaExceeded = false
  const timers = []

  async function pollAirport(airport) {
    if (quotaExceeded) return
    try {
      const res  = await fetch(buildUrl(airport.iata, key), { signal: AbortSignal.timeout(10_000) })
      const data = await res.json()
      // AirLabs returns HTTP 200 with an { error } body for auth/quota failures,
      // so res.ok alone can't be trusted — without this check, a quota error
      // resolves to an empty `response` array and gets summarised as 0 departures.
      if (!res.ok || data.error) throw new Error(data.error?.message || `AirLabs HTTP ${res.status}`)

      const summary = summarise(data.response, airport.iata, airport.name)
      store.fids = { ...(store.fids ?? {}), [airport.iata]: summary }
      broadcast('fids', store.fids)
      console.log(`[FIDS] ${airport.iata}: ${summary.departures} deps, ${summary.delayed} delayed`)
    } catch (err) {
      console.warn(`[FIDS] ${airport.iata} failed:`, err.message)
      if (/limit|quota/i.test(err.message) && !quotaExceeded) {
        quotaExceeded = true
        console.warn('[FIDS] AirLabs quota exhausted — switching to OpenSky fallback for this session')
        timers.forEach(clearInterval)
        runOpenSkyFallback(broadcast, store)
      }
    }
  }

  AIRPORTS.forEach((airport, i) => {
    timers.push(setTimeout(() => {
      pollAirport(airport)
      timers.push(setInterval(() => pollAirport(airport), POLL_MS_AIRLABS))
    }, i * 2_000))
  })
}
