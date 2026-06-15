import fetch from 'node-fetch'

const POLL_MS = 30 * 60 * 1000  // 30 min — AQ + SST update slowly

// ── Air Quality — OpenAQ v2 (free, no auth) ─────────────────────────
const AQ_CITIES = ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide']

function pm25ToAqi(pm) {
  const bp = [
    [0, 12, 0, 50], [12.1, 35.4, 51, 100], [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200], [150.5, 250.4, 201, 300], [250.5, 500, 301, 500],
  ]
  for (const [cLo, cHi, iLo, iHi] of bp) {
    if (pm >= cLo && pm <= cHi)
      return Math.round(((iHi - iLo) / (cHi - cLo)) * (pm - cLo) + iLo)
  }
  return 500
}

function aqiCategory(aqi) {
  if (aqi <= 50)  return { label: 'Good',           color: '#00e676' }
  if (aqi <= 100) return { label: 'Moderate',       color: '#fdd835' }
  if (aqi <= 150) return { label: 'Sensitive',      color: '#ff8f00' }
  if (aqi <= 200) return { label: 'Unhealthy',      color: '#ff3d6b' }
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#9c27b0' }
  return            { label: 'Hazardous',           color: '#7b0000' }
}

async function fetchAirQuality() {
  const results = await Promise.allSettled(AQ_CITIES.map(async city => {
    const url = `https://api.openaq.org/v2/latest?country=AU&city=${encodeURIComponent(city)}&parameter=pm25&limit=5`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AustraliaMonitor/1.0' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) throw new Error(`OpenAQ HTTP ${res.status}`)
    const json = await res.json()
    const readings = (json.results ?? [])
      .flatMap(r => (r.measurements ?? []).filter(m => m.parameter === 'pm25'))
    if (!readings.length) throw new Error(`No PM2.5 for ${city}`)
    const avg = readings.reduce((s, m) => s + m.value, 0) / readings.length
    const aqi = pm25ToAqi(avg)
    return { name: city, aqi, pm25: +avg.toFixed(1), ...aqiCategory(aqi) }
  }))

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: AQ_CITIES[i], aqi: null, pm25: null, label: 'N/A', color: '#4a6080' }
  )
}

// ── Fire Danger — Seasonal defaults (BOM XML too complex/unreliable) ─
const FIRE_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']

function seasonalFDR() {
  const month  = new Date().getMonth() + 1
  const summer = month >= 11 || month <= 3
  const spring = month >= 9 && month <= 11
  const ntDry  = month >= 4 && month <= 9
  return {
    NSW: summer ? 'Very High' : spring ? 'High' : 'Low-Moderate',
    VIC: summer ? 'Severe'    : spring ? 'High' : 'Low-Moderate',
    QLD: summer ? 'High'      : spring ? 'High' : 'Low-Moderate',
    SA:  summer ? 'Very High' : spring ? 'High' : 'Low-Moderate',
    WA:  summer ? 'High'      : spring ? 'High' : 'Low-Moderate',
    TAS: summer ? 'Very High' : 'Low-Moderate',
    NT:  ntDry  ? 'Very High' : 'Low-Moderate',
    ACT: summer ? 'Severe'    : spring ? 'High' : 'Low-Moderate',
  }
}

async function fetchFireDanger() {
  try {
    const res = await fetch('http://www.bom.gov.au/fwo/IDZ00059.xml', {
      headers: { 'User-Agent': 'AustraliaMonitor/1.0' },
      signal: AbortSignal.timeout(6_000),
    })
    if (!res.ok) throw new Error(`BOM HTTP ${res.status}`)
    const xml = await res.text()
    const ratings = {}
    const re = /state="([A-Z]{2,3})"[^>]*fire[_-]?danger[^"]*"([^"]+)"/gi
    let m
    while ((m = re.exec(xml)) !== null) {
      if (FIRE_STATES.includes(m[1])) ratings[m[1]] = m[2]
    }
    if (Object.keys(ratings).length >= 3) return { ratings, source: 'bom' }
  } catch (err) {
    console.warn('[VITALS] BOM fire XML:', err.message)
  }
  return { ratings: seasonalFDR(), source: 'seasonal' }
}

// ── Reservoir Levels — indicative static values ───────────────────────
const RESERVOIRS = [
  { name: 'Warragamba', city: 'Sydney',    state: 'NSW', pct: 78.4 },
  { name: 'Thomson',    city: 'Melbourne', state: 'VIC', pct: 63.1 },
  { name: 'Serpentine', city: 'Perth',     state: 'WA',  pct: 42.0 },
  { name: 'Hume',       city: 'Murray',    state: 'NSW', pct: 56.8 },
  { name: 'Kangaroo Ck', city: 'Adelaide', state: 'SA',  pct: 55.2 },
]

async function fetchReservoirLevels() {
  return { reservoirs: RESERVOIRS, source: 'static' }
}

// ── GBR Sea Surface Temperature — NOAA CoralWatch ───────────────────
const NOAA_GBR_URLS = [
  'https://coralreefwatch.noaa.gov/vs/gauges/json/great_barrier_reef.json',
  'https://coralreefwatch.noaa.gov/product/vs/gaugesV3.5/data/great_barrier_reef.txt',
]

function gbrSeasonalMock() {
  const month  = new Date().getMonth() + 1
  const summer = month >= 11 || month <= 3
  return {
    sst:            +(summer ? 29.2 + Math.random() * 0.6 : 24.3 + Math.random() * 0.5).toFixed(1),
    anomaly:        +(summer ? 1.2 + Math.random() * 0.4  : 0.2 + Math.random() * 0.3).toFixed(1),
    bleachingAlert: summer ? 1 : 0,
    source:         'mock',
  }
}

async function fetchGbrSst() {
  for (const url of NOAA_GBR_URLS) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AustraliaMonitor/1.0' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('json')) continue
      const json = await res.json()
      const sst = json.sst ?? json.sea_surface_temp ?? null
      if (!sst) continue
      return {
        sst:            +sst.toFixed(1),
        anomaly:        +(json.sst_anomaly ?? json.anomaly ?? 0).toFixed(1),
        bleachingAlert: json.alert_level ?? 0,
        source:         'noaa',
      }
    } catch { /* try next */ }
  }
  console.warn('[VITALS] NOAA GBR SST unavailable — using seasonal mock')
  return gbrSeasonalMock()
}

// ── Aggregate ────────────────────────────────────────────────────────
export async function fetchVitals() {
  const [aq, fire, res, gbr] = await Promise.allSettled([
    fetchAirQuality(),
    fetchFireDanger(),
    fetchReservoirLevels(),
    fetchGbrSst(),
  ])

  const vitals = {
    airQuality: aq.status   === 'fulfilled' ? aq.value   : [],
    fireDanger: fire.status === 'fulfilled' ? fire.value : { ratings: seasonalFDR(), source: 'seasonal' },
    reservoirs: res.status  === 'fulfilled' ? res.value  : { reservoirs: RESERVOIRS, source: 'static' },
    gbr:        gbr.status  === 'fulfilled' ? gbr.value  : gbrSeasonalMock(),
    updatedAt:  new Date().toISOString(),
  }
  const aqOk = vitals.airQuality.filter(c => c.aqi != null).length
  console.log(`[VITALS] AQ:${aqOk}/${AQ_CITIES.length} fire:${vitals.fireDanger.source} res:${vitals.reservoirs.source} gbr:${vitals.gbr.source}`)
  return vitals
}

export function startVitalsPoller(broadcast, store) {
  async function poll() {
    try {
      const data = await fetchVitals()
      store.vitals = data
      broadcast('vitals', data)
    } catch (err) {
      console.warn('[VITALS] Poll failed:', err.message)
    }
  }
  poll()
  setInterval(poll, POLL_MS)
}
