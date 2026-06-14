import fetch from 'node-fetch'

// USGS FDSN — same GeoJSON format, covers AU, free and reliable
const GA_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&minlatitude=-44&maxlatitude=-10&minlongitude=112&maxlongitude=154&orderby=time&limit=50'
const POLL_MS = 5 * 60 * 1000

function parseFeatures(features) {
  return (features || [])
    .map(f => {
      const [lon, lat, depth] = f.geometry?.coordinates ?? []
      return {
        id:        f.id,
        lat,
        lon,
        depth:     depth ?? 0,
        magnitude: f.properties?.mag ?? 0,
        place:     f.properties?.place ?? '',
        time:      f.properties?.time ?? 0,
      }
    })
    .filter(e => e.lat != null && e.lon != null)
}

export function startSeismicPoller(broadcast) {
  async function poll() {
    try {
      const res = await fetch(GA_URL, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error(`GA seismic HTTP ${res.status}`)
      const data = await res.json()
      const events = parseFeatures(data.features)
      broadcast('seismic', events)
      console.log(`[SEISMIC] ${events.length} events`)
    } catch (err) {
      console.warn('[SEISMIC] Poll failed:', err.message)
    }
  }

  poll()
  setInterval(poll, POLL_MS)
}
