import fetch from 'node-fetch'

// ABS releases monthly/quarterly — poll every 12 hours
const POLL_MS = 12 * 60 * 60 * 1000

const ABS = 'https://api.data.abs.gov.au/data'

// ── shared helpers ────────────────────────────────────────────────────────────

async function absGet(path) {
  const res = await fetch(`${ABS}/${path}`, {
    headers: { Accept: 'application/vnd.sdmx.data+json;version=1.0' },
    signal: AbortSignal.timeout(15_000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`ABS HTTP ${res.status} — ${path}`)
  return res.json()
}

// Returns [{period: 'YYYY-MM', value: number}, ...] sorted chronologically
function extractTimeSeries(json) {
  // SDMX-JSON 1.x uses data.structure (object), 2.x uses data.structures (array)
  const structs  = json.data?.structures?.[0] ?? json.data?.structure
  const ds       = json.data?.dataSets?.[0]
  if (!structs || !ds) throw new Error('Unexpected ABS response structure')

  const obsDims  = structs.dimensions?.observation ?? []
  const timeDim  = obsDims[0] // TIME_PERIOD is always the first obs dimension
  const periods  = timeDim?.values?.map(v => v.id) ?? []

  // SDMX can use either series-keyed or flat observations
  let rawObs = ds.observations ?? null
  if (!rawObs) {
    const seriesMap = ds.series ?? {}
    const firstKey  = Object.keys(seriesMap)[0]
    rawObs = seriesMap[firstKey]?.observations ?? {}
  }

  const pts = Object.entries(rawObs).map(([k, v]) => {
    const pidx   = parseInt(k.split(':').pop())
    const period = periods[pidx]
    return { period, value: v[0] }
  }).filter(p => p.period && p.value != null)

  // Sort chronologically (YYYY-QN or YYYY-MM)
  return pts.sort((a, b) => a.period.localeCompare(b.period))
}

// ── individual indicators ─────────────────────────────────────────────────────

async function fetchUnemployment() {
  // Labour Force — M13=Unemployment rate, SEX=3 Persons, AGE=1599 Total,
  //                TSEST=20 Seasonally adjusted, REGION=AUS, FREQ=M
  const json   = await absGet('ABS,LF/M13.3.1599.20.AUS.M?format=jsondata&detail=dataonly&startPeriod=2024-01')
  const series = extractTimeSeries(json)
  if (!series.length) throw new Error('No LF observations')
  const last = series[series.length - 1]
  return { value: +last.value.toFixed(1), period: last.period, source: 'abs' }
}

async function fetchCPI() {
  // CPI — MEASURE=1 Index numbers, INDEX=10001 All groups, TSEST=10 Original,
  //       REGION=50 Australia, FREQ=Q quarterly
  const json   = await absGet('ABS,CPI/1.10001.10.50.Q?format=jsondata&detail=dataonly&startPeriod=2023-Q1')
  const series = extractTimeSeries(json)
  if (series.length < 5) throw new Error('Not enough CPI observations for YoY')

  const latest  = series[series.length - 1]
  // Walk backwards to find the observation exactly 4 quarters prior
  const yearAgo = series.find(s => s.period === quarterMinus4(latest.period))
              ?? series[series.length - 5]

  const yoy = (latest.value / yearAgo.value - 1) * 100
  return { value: +yoy.toFixed(1), period: latest.period, source: 'abs' }
}

// Subtract 4 quarters from a YYYY-QN string
function quarterMinus4(period) {
  const m = period.match(/^(\d{4})-Q(\d)$/)
  if (!m) return null
  const year = parseInt(m[1])
  const q    = parseInt(m[2])
  return `${year - 1}-Q${q}`
}

async function fetchPopulation() {
  // ERP — Estimated Resident Population, Australia quarterly
  // MEASURE=1, REGIONTYPE=AUS, REGION=AUS, FREQ=Q
  const json   = await absGet('ABS,ERP_Q/1..AUS.Q?format=jsondata&detail=dataonly&startPeriod=2024-Q1')
  const series = extractTimeSeries(json)
  if (!series.length) throw new Error('No ERP observations')
  const last = series[series.length - 1]
  // ERP is in persons — convert to millions
  return { value: +(last.value / 1_000_000).toFixed(2), period: last.period, source: 'abs' }
}

// ── GDP via National Accounts ─────────────────────────────────────────────────
// NA dataset is complex — derive growth from chain volume measures

async function fetchGDP() {
  // GDP current prices, national total, original, quarterly
  const json = await absGet('ABS,NA/3.1.1..M.Q?format=jsondata&detail=dataonly&startPeriod=2023-Q1')
  const series = extractTimeSeries(json)
  if (series.length < 5) throw new Error('Not enough GDP observations')
  const latest  = series[series.length - 1]
  const yearAgo = series.find(s => s.period === quarterMinus4(latest.period))
              ?? series[series.length - 5]
  const growth  = (latest.value / yearAgo.value - 1) * 100
  return { value: +growth.toFixed(1), period: latest.period, source: 'abs' }
}

// ── fallback ─────────────────────────────────────────────────────────────────

function mockAbs() {
  return {
    unemployment: { value: 4.0,   period: '2026-04', source: 'mock' },
    cpi:          { value: 2.8,   period: '2026-Q1', source: 'mock' },
    gdpGrowth:    { value: 1.8,   period: '2026-Q1', source: 'mock' },
    population:   { value: 27.01, period: '2025-Q4', source: 'mock' },
  }
}

// ── public API ────────────────────────────────────────────────────────────────

export async function fetchAbsData() {
  const [unempR, cpiR, popR, gdpR] = await Promise.allSettled([
    fetchUnemployment(),
    fetchCPI(),
    fetchPopulation(),
    fetchGDP(),
  ])

  if (unempR.status === 'rejected') console.warn('[ABS] Unemployment:', unempR.reason.message)
  if (cpiR.status   === 'rejected') console.warn('[ABS] CPI:',          cpiR.reason.message)
  if (popR.status   === 'rejected') console.warn('[ABS] Population:',   popR.reason.message)
  if (gdpR.status   === 'rejected') console.warn('[ABS] GDP:',          gdpR.reason.message)

  const mock = mockAbs()
  return {
    unemployment: unempR.status === 'fulfilled' ? unempR.value : mock.unemployment,
    cpi:          cpiR.status   === 'fulfilled' ? cpiR.value   : mock.cpi,
    population:   popR.status   === 'fulfilled' ? popR.value   : mock.population,
    gdpGrowth:    gdpR.status   === 'fulfilled' ? gdpR.value   : mock.gdpGrowth,
    updatedAt:    new Date().toISOString(),
  }
}

export function startAbsPoller(broadcast, store) {
  async function poll() {
    try {
      const data = await fetchAbsData()
      store.absData = data
      broadcast('abs_data', data)
      const uSrc = data.unemployment.source === 'abs' ? '✓' : '~'
      const cSrc = data.cpi.source          === 'abs' ? '✓' : '~'
      console.log(`[ABS] ${uSrc}Unemployment ${data.unemployment.value}% · ${cSrc}CPI ${data.cpi.value}% YoY · Pop ${data.population.value}M`)
    } catch (err) {
      console.warn('[ABS] Poll failed:', err.message)
    }
  }

  poll()
  setInterval(poll, POLL_MS)
}
