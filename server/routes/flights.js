import fetch from 'node-fetch'

const AU_BBOX = { lamin: -44, lamax: -10, lomin: 112, lomax: 154 }
const POLL_MS = 120_000  // 2 min → 720 req/day, well within 4000 credit limit
const OPENSKY_URL =
  `https://opensky-network.org/api/states/all` +
  `?lamin=${AU_BBOX.lamin}&lamax=${AU_BBOX.lamax}` +
  `&lomin=${AU_BBOX.lomin}&lomax=${AU_BBOX.lomax}`

const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'

const CLIENT_ID     = process.env.OPENSKY_CLIENT_ID
const CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET

/* OAuth2 token cache — refresh 30s before expiry */
let tokenCache = { value: null, expiresAt: 0 }

async function getBearerToken() {
  if (Date.now() < tokenCache.expiresAt - 30_000) return tokenCache.value

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(8_000),
  })

  if (!res.ok) throw new Error(`OpenSky token ${res.status}`)
  const data = await res.json()
  tokenCache = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1_000 }
  console.log('[FLIGHTS] OAuth2 token refreshed')
  return tokenCache.value
}

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
  const useAuth = CLIENT_ID && CLIENT_SECRET

  async function poll() {
    try {
      const headers = {}
      if (useAuth) {
        const token = await getBearerToken()
        headers.Authorization = `Bearer ${token}`
      }

      const res = await fetch(OPENSKY_URL, { headers, signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`)

      const data    = await res.json()
      const flights = parseStates(data.states)
      if (store) store.flights = flights
      broadcast('flights', flights)
      console.log(`[FLIGHTS] ${flights.length} aircraft in AU airspace${useAuth ? ' (authenticated)' : ''}`)
    } catch (err) {
      console.warn('[FLIGHTS] Poll failed:', err.message)
    }
  }

  poll()
  setInterval(poll, POLL_MS)
}
