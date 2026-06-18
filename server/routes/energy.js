import fetch from 'node-fetch'

// AEMO updates every 5 minutes
const POLL_MS = 5 * 60 * 1000

// AEMO's public visualisations API — confirmed live, no key required
const AEMO_URL = 'https://visualisations.aemo.com.au/aemo/apps/api/report/ELEC_NEM_SUMMARY'

// Known approximate fuel mix within each region's SCHEDULED generation (coal+gas+hydro)
// Based on AEMO NEM Generation Information publications
const SCHED_FUEL_SPLIT = {
  NSW: { coal: 0.62, gas: 0.22, hydro: 0.16 },
  VIC: { coal: 0.58, gas: 0.30, hydro: 0.12 },
  QLD: { coal: 0.70, gas: 0.24, hydro: 0.06 },
  SA:  { coal: 0.00, gas: 0.88, hydro: 0.12 },
  TAS: { coal: 0.00, gas: 0.08, hydro: 0.92 },
}

// Semi-scheduled = wind + utility solar. Solar fraction varies by hour of day.
// Peak solar capacity ratios per region (daytime peak fractions)
const SOLAR_PEAK_FRAC = { NSW: 0.45, VIC: 0.35, QLD: 0.60, SA: 0.40, TAS: 0.15 }

function semiSplit(regionId) {
  const hour = new Date().getHours()
  // Solar follows a bell curve: zero before 6am/after 8pm, peak around 1pm
  const solarFrac = (hour >= 6 && hour <= 20)
    ? Math.sin(Math.PI * (hour - 6) / 14) * (SOLAR_PEAK_FRAC[regionId] ?? 0.40)
    : 0
  return { wind: +(1 - solarFrac).toFixed(3), solar: +solarFrac.toFixed(3) }
}

async function fetchAemo() {
  const res = await fetch(AEMO_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AustraliaMonitor/1.0)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`AEMO HTTP ${res.status}`)
  const json = await res.json()

  const rows = json.ELEC_NEM_SUMMARY ?? []
  if (!rows.length) throw new Error('AEMO returned empty NEM summary')

  const regions = {}
  const totals  = { coal: 0, gas: 0, hydro: 0, wind: 0, solar: 0 }
  let totalDemand = 0

  for (const r of rows) {
    const id   = r.REGIONID?.replace(/\d+$/, '')    // NSW1 → NSW
    const sched = r.SCHEDULEDGENERATION    ?? 0
    const semi  = r.SEMISCHEDULEDGENERATION ?? 0

    if (!id || !SCHED_FUEL_SPLIT[id]) continue

    regions[id] = {
      demand: +r.TOTALDEMAND.toFixed(0),
      price:  +r.PRICE.toFixed(2),
      sched:  +sched.toFixed(0),
      semi:   +semi.toFixed(0),
    }
    totalDemand += r.TOTALDEMAND

    // Apportion scheduled gen into coal / gas / hydro
    const sf = SCHED_FUEL_SPLIT[id]
    totals.coal  += sched * sf.coal
    totals.gas   += sched * sf.gas
    totals.hydro += sched * sf.hydro

    // Apportion semi-scheduled gen into wind / solar (time-of-day aware)
    const mf = semiSplit(id)
    totals.wind  += semi * mf.wind
    totals.solar += semi * mf.solar
  }

  if (totalDemand < 1000) throw new Error('AEMO data looks implausible')

  const totalGen = Object.values(totals).reduce((a, b) => a + b, 0)
  const generation = {}
  for (const [type, mw] of Object.entries(totals)) {
    generation[type] = { mw: +mw.toFixed(0), pct: +(mw / totalGen * 100).toFixed(1) }
  }

  const renewablesMw = totals.hydro + totals.wind + totals.solar
  const renewablesPct = +(renewablesMw / totalGen * 100).toFixed(1)

  return {
    total_mw:       +totalDemand.toFixed(0),
    renewables_pct: renewablesPct,
    generation,
    regions,
    source:         'aemo',
  }
}

function mockEnergy() {
  return {
    total_mw:       24_850,
    renewables_pct: 43.2,
    generation: {
      coal:  { mw: 9_200, pct: 37.0 },
      gas:   { mw: 3_850, pct: 15.5 },
      wind:  { mw: 5_400, pct: 21.7 },
      solar: { mw: 3_800, pct: 15.3 },
      hydro: { mw: 1_950, pct: 7.8 },
    },
    regions: {
      NSW: { demand: 8_800, price: 52.40, sched: 7_200, semi: 680 },
      VIC: { demand: 5_900, price: 58.10, sched: 4_800, semi: 520 },
      QLD: { demand: 6_200, price: 47.30, sched: 5_400, semi: 790 },
      SA:  { demand: 1_750, price: 71.20, sched:   890, semi: 980 },
      TAS: { demand: 1_200, price: 38.50, sched: 1_100, semi:  50 },
    },
    source: 'mock',
  }
}

export async function fetchRealEnergy() {
  try {
    const data = await fetchAemo()
    return { ...data, updatedAt: new Date().toISOString() }
  } catch (err) {
    console.warn('[ENERGY] AEMO fetch failed:', err.message)
    return { ...mockEnergy(), updatedAt: new Date().toISOString() }
  }
}

export function startEnergyPoller(broadcast, store) {
  async function poll() {
    try {
      const data = await fetchRealEnergy()
      store.energy = data
      broadcast('energy', data)
      const src = data.source === 'aemo' ? '✓' : '~'
      console.log(`[ENERGY] ${src}${data.total_mw.toLocaleString()}MW total · ${data.renewables_pct}% renewables (${data.source})`)
    } catch (err) {
      console.warn('[ENERGY] Poll failed:', err.message)
    }
  }

  poll()
  setInterval(poll, POLL_MS)
}
