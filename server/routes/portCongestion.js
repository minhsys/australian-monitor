// Port congestion — derived from existing AIS ship feed (ships.js), no new API needed.
// AIS NavigationalStatus codes: 1 = at anchor, 5 = moored — vessels sitting in either
// state near a major seaport are treated as queued/idle rather than transiting.
const IDLE_STATUS_CODES = new Set([1, 5])

const EARTH_RADIUS_KM = 6371
const PORT_RADIUS_KM  = 20
const POLL_MS          = 60 * 1000

const MAJOR_PORTS = [
  { name: 'Port of Brisbane',     lat: -27.37, lon: 153.17 },
  { name: 'Port Botany (Sydney)', lat: -33.97, lon: 151.20 },
  { name: 'Port of Melbourne',    lat: -37.83, lon: 144.93 },
  { name: 'Fremantle Port',       lat: -32.05, lon: 115.74 },
  { name: 'Port Adelaide',        lat: -34.84, lon: 138.49 },
  { name: 'Darwin Port',          lat: -12.47, lon: 130.85 },
  { name: 'Port of Newcastle',    lat: -32.91, lon: 151.80 },
  { name: 'Port Kembla',          lat: -34.48, lon: 150.91 },
  { name: 'Port Hedland',         lat: -20.32, lon: 118.60 },
  { name: 'Gladstone Port',       lat: -23.86, lon: 151.25 },
  { name: 'Hay Point (Coal)',     lat: -21.28, lon: 149.30 },
]

function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

function congestionLevel(idleCount) {
  if (idleCount >= 10) return 4
  if (idleCount >= 6)  return 3
  if (idleCount >= 3)  return 2
  if (idleCount >= 1)  return 1
  return 0
}

export function computePortCongestion(ships) {
  const list = Array.isArray(ships) ? ships : Object.values(ships ?? {})

  return MAJOR_PORTS.map(port => {
    const nearby = list.filter(s => haversineKm(port.lat, port.lon, s.lat, s.lon) <= PORT_RADIUS_KM)
    const idle   = nearby.filter(s => IDLE_STATUS_CODES.has(s.status))

    return {
      name:        port.name,
      lat:         port.lat,
      lon:         port.lon,
      nearbyCount: nearby.length,
      idleCount:   idle.length,
      level:       congestionLevel(idle.length),
    }
  })
}

export function startPortCongestionPoller(broadcast, store) {
  function compute() {
    const result = computePortCongestion(store.ships)
    store.portCongestion = result
    broadcast('port_congestion', result)

    const congested = result.filter(p => p.level >= 2)
    if (congested.length) {
      console.log(`[PORT CONGESTION] ${congested.map(p => `${p.name}: ${p.idleCount} idle`).join(', ')}`)
    }
  }

  compute()
  setInterval(compute, POLL_MS)
}
