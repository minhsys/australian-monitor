import fetch from 'node-fetch'

const POLL_MS = 10 * 60 * 1000

function buildUrl(key) {
  // bbox order: W,S,E,N (lon_min,lat_min,lon_max,lat_max)
  return `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/112,-44,154,-10/1`
}

function parseCsv(csv) {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',')
  const idx = {
    lat:        headers.indexOf('latitude'),
    lon:        headers.indexOf('longitude'),
    brightness: headers.indexOf('bright_ti4'),
    confidence: headers.indexOf('confidence'),
    date:       headers.indexOf('acq_date'),
  }

  return lines.slice(1).map(line => {
    const cols = line.split(',')
    return {
      lat:        parseFloat(cols[idx.lat]),
      lon:        parseFloat(cols[idx.lon]),
      brightness: parseFloat(cols[idx.brightness]),
      confidence: cols[idx.confidence] ?? '',
      date:       cols[idx.date] ?? '',
    }
  }).filter(f => !isNaN(f.lat) && !isNaN(f.lon))
}

export function startFiresPoller(broadcast, store) {
  async function poll() {
    const key = process.env.NASA_FIRMS_KEY
    if (!key) {
      console.warn('[FIRES] NASA_FIRMS_KEY not set — fire layer disabled')
      return
    }

    try {
      const res = await fetch(buildUrl(key), { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new Error(`NASA FIRMS HTTP ${res.status}`)
      const csv = await res.text()
      const fires = parseCsv(csv)
      store.fires = fires
      broadcast('fires', fires)
      console.log(`[FIRES] ${fires.length} hotspots`)
    } catch (err) {
      console.warn('[FIRES] Poll failed:', err.message)
    }
  }

  poll()
  setInterval(poll, POLL_MS)
}
