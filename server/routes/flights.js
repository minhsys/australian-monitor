import fetch from 'node-fetch'

const POLL_MS    = 120_000  // 2 min
const RADIUS_NM  = 250      // airplanes.live point endpoint hard cap
const FT_TO_M    = 0.3048
const KT_TO_MS   = 0.514444
const USER_AGENT = 'australia-intelligence-monitor (https://github.com/minhsys/australian-monitor)'

// Regional centers spaced to keep overlapping 250nm coverage across the AU mainland + Tasmania
const CENTERS = [
  { name: 'PER', lat: -31.95, lon: 115.86 },
  { name: 'ADL', lat: -34.93, lon: 138.60 },
  { name: 'DRW', lat: -12.46, lon: 130.84 },
  { name: 'ASP', lat: -23.70, lon: 133.88 },
  { name: 'SYD', lat: -33.87, lon: 151.21 },
  { name: 'MEL', lat: -37.81, lon: 144.96 },
  { name: 'BNE', lat: -27.47, lon: 153.02 },
  { name: 'CNS', lat: -16.92, lon: 145.77 },
  { name: 'HBA', lat: -42.88, lon: 147.33 },
]

function parseAircraft(ac) {
  if (typeof ac.alt_baro !== 'number') return null  // 'ground' or missing — skip, mirrors prior onGround filter
  if (ac.lat == null || ac.lon == null) return null
  return {
    icao24:   ac.hex,
    callsign: (ac.flight || '').trim(),
    country:  null,
    lon:      ac.lon,
    lat:      ac.lat,
    altitude: ac.alt_baro * FT_TO_M,
    onGround: false,
    velocity: (ac.gs ?? 0) * KT_TO_MS,
    heading:  ac.track ?? 0,
  }
}

async function fetchRegion(center) {
  const url = `https://api.airplanes.live/v2/point/${center.lat}/${center.lon}/${RADIUS_NM}`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`airplanes.live HTTP ${res.status} (${center.name})`)
  const data = await res.json()
  return data.ac || []
}

export function startFlightsPoller(broadcast, store) {
  async function poll() {
    try {
      const results = await Promise.allSettled(CENTERS.map(fetchRegion))

      const byIcao = new Map()
      for (const result of results) {
        if (result.status !== 'fulfilled') continue
        for (const ac of result.value) {
          const flight = parseAircraft(ac)
          if (flight) byIcao.set(flight.icao24, flight)
        }
      }

      const flights = [...byIcao.values()]
      if (store) store.flights = flights
      broadcast('flights', flights)

      const failedRegions = results.filter(r => r.status === 'rejected').length
      const suffix = failedRegions ? ` (${failedRegions}/${CENTERS.length} regions failed)` : ''
      console.log(`[FLIGHTS] ${flights.length} aircraft in AU airspace${suffix}`)
    } catch (err) {
      console.warn('[FLIGHTS] Poll failed:', err.message)
    }
  }

  poll()
  setInterval(poll, POLL_MS)
}
