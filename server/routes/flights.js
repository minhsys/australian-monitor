import fetch from 'node-fetch'

const AU_BBOX = { lamin: -44, lamax: -10, lomin: 112, lomax: 154 }
const POLL_MS = 300_000  // OpenSky: 400 req/day limit → 5 min = 288/day
const OPENSKY_URL =
  `https://opensky-network.org/api/states/all` +
  `?lamin=${AU_BBOX.lamin}&lamax=${AU_BBOX.lamax}` +
  `&lomin=${AU_BBOX.lomin}&lomax=${AU_BBOX.lomax}`

function parseStates(states) {
  return (states || [])
    .map(s => ({
      icao24:   s[0],
      callsign: (s[1] || '').trim(),
      country:  s[2],
      lon:      s[5],
      lat:      s[6],
      altitude: s[7],
      onGround: s[8],
      velocity: s[9],
      heading:  s[10] ?? 0,
    }))
    .filter(f => f.lat !== null && f.lon !== null && !f.onGround)
}

export function startFlightsPoller(broadcast, store) {
  async function poll() {
    try {
      const res = await fetch(OPENSKY_URL, { signal: AbortSignal.timeout(7_000) })
      if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`)
      const data = await res.json()
      const flights = parseStates(data.states)
      if (store) store.flights = flights
      broadcast('flights', flights)
      console.log(`[FLIGHTS] ${flights.length} aircraft in AU airspace`)
    } catch (err) {
      console.warn('[FLIGHTS] Poll failed:', err.message)
    }
  }

  poll()
  setInterval(poll, POLL_MS)
}
