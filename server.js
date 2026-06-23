import 'dotenv/config'
import express    from 'express'
import http       from 'http'
import { WebSocketServer } from 'ws'
import path       from 'path'
import { fileURLToPath } from 'url'
import { startFlightsPoller }                        from './server/routes/flights.js'
import { startShipsWatcher }                         from './server/routes/ships.js'
import { startSeismicPoller }                        from './server/routes/seismic.js'
import { startFiresPoller }                          from './server/routes/fires.js'
import { startFloodsPoller }                         from './server/routes/floods.js'
import { fetchRealFinancial, startFinancialPoller }  from './server/routes/financial.js'
import { fetchRealWeather, startWeatherPoller }       from './server/routes/weather.js'
import { startFidsPoller }                            from './server/routes/fids.js'
import { fetchRealNews }                              from './server/routes/news.js'
import { startAiBriefPoller }                         from './server/routes/aiBrief.js'
import { fetchCables }                                from './server/routes/cables.js'
import { fetchRealEnergy, startEnergyPoller }         from './server/routes/energy.js'
import { fetchAbsData, startAbsPoller }               from './server/routes/abs.js'
import { startVitalsPoller }                          from './server/routes/vitals.js'
import { startThreatIndexPoller }                     from './server/routes/threatIndex.js'
import { startRoadClosuresPoller }                    from './server/routes/roadClosures.js'
import { startPortCongestionPoller }                  from './server/routes/portCongestion.js'
import { startEnergyOutagesPoller }                   from './server/routes/energyOutages.js'
import { startEmergencyAlertsPoller }                 from './server/routes/emergencyAlerts.js'
import { startEmergencyImpactPoller }                 from './server/routes/emergencyImpact.js'
import { startEmergencyCrossCheckPoller }             from './server/routes/emergencyCrossCheck.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app       = express()
const server    = http.createServer(app)
const wss       = new WebSocketServer({ server, path: '/ws' })
const PORT      = process.env.PORT || 3001

app.use(express.json())

/* ─────────────────────────────────────────────
   Anti-cache headers for live data endpoints
───────────────────────────────────────────── */
const noCache = (_, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  next()
}

/* ─────────────────────────────────────────────
   In-memory data store
───────────────────────────────────────────── */
const store = {
  news:      [],
  financial: null,
  weather:   null,
  energy:    null,
  absData:   null,
  vitals:    null,
  feedStats: { total: 13, online: 0, totalFeeds: 0 },
}

function computeFeedStats() {
  const checks = [
    store.news?.length > 0,
    store.financial != null,
    store.weather != null,
    store.flights?.length > 0,
    store.ships && Object.keys(store.ships).length > 0,
    store.seismic != null,
    store.fires != null,
    store.floods != null,
    store.fids != null,
    store.energy != null,
    store.absData != null,
    store.vitals != null,
    store.aiBrief != null,
  ]
  return {
    total:      checks.length,
    online:     checks.filter(Boolean).length,
    totalFeeds: store.news?.length ?? 0,
  }
}

/* ─────────────────────────────────────────────
   WebSocket — broadcast to all connected clients
───────────────────────────────────────────── */
function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload })
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(msg)
  })
}

wss.on('connection', (ws) => {
  console.log('[WS] Client connected')
  if (store.news.length)   ws.send(JSON.stringify({ type: 'news_batch', payload: store.news.slice(0, 200) }))
  if (store.financial)     ws.send(JSON.stringify({ type: 'financial',  payload: store.financial }))
  if (store.feedStats)     ws.send(JSON.stringify({ type: 'feedStats',  payload: store.feedStats }))
  if (store.weather)       ws.send(JSON.stringify({ type: 'weather',    payload: store.weather }))
  if (store.aiBrief)       ws.send(JSON.stringify({ type: 'ai_brief',   payload: store.aiBrief }))
  if (store.energy)        ws.send(JSON.stringify({ type: 'energy',     payload: store.energy }))
  if (store.absData)       ws.send(JSON.stringify({ type: 'abs_data',   payload: store.absData }))
  if (store.vitals)        ws.send(JSON.stringify({ type: 'vitals',     payload: store.vitals }))
  if (store.flights?.length)
    ws.send(JSON.stringify({ type: 'flights', payload: store.flights }))
  if (store.ships && Object.keys(store.ships).length)
    Object.values(store.ships).forEach(ship =>
      ws.send(JSON.stringify({ type: 'ships', payload: ship }))
    )
  if (store.fires?.length)
    ws.send(JSON.stringify({ type: 'fires', payload: store.fires }))
  if (store.floods?.length)
    ws.send(JSON.stringify({ type: 'floods', payload: store.floods }))
  if (store.seismic?.length)
    ws.send(JSON.stringify({ type: 'seismic', payload: store.seismic }))
  if (store.warnings?.length)
    ws.send(JSON.stringify({ type: 'warnings', payload: store.warnings }))
  if (store.threatIndex)
    ws.send(JSON.stringify({ type: 'threat_index', payload: store.threatIndex }))
  if (store.roadClosures?.length)
    ws.send(JSON.stringify({ type: 'road_closures', payload: store.roadClosures }))
  if (store.portCongestion?.length)
    ws.send(JSON.stringify({ type: 'port_congestion', payload: store.portCongestion }))
  if (store.energyOutages)
    ws.send(JSON.stringify({ type: 'energy_outages', payload: store.energyOutages }))
  if (store.emergencyAlerts?.length)
    ws.send(JSON.stringify({ type: 'emergency_alerts', payload: store.emergencyAlerts }))
  if (store.emergencyImpact)
    ws.send(JSON.stringify({ type: 'emergency_impact', payload: store.emergencyImpact }))
  if (store.emergencyCrossCheck)
    ws.send(JSON.stringify({ type: 'emergency_cross_check', payload: store.emergencyCrossCheck }))
})

/* ─────────────────────────────────────────────
   API Routes
───────────────────────────────────────────── */
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    feedStats: store.feedStats,
    newsCount: store.news.length,
    lastFinancialUpdate: store.financial?.updatedAt ?? null,
  })
})

app.get('/api/news', noCache, (_, res) => {
  res.json({ items: store.news.slice(0, 200) })
})

app.get('/api/financial', noCache, (_, res) => {
  res.json(store.financial ?? getMockFinancial())
})

app.get('/api/weather', noCache, (_, res) => {
  res.json(store.weather ?? getMockWeather())
})

app.post('/api/force-poll', async (_, res) => {
  console.log('[API] Force poll triggered')
  await runAllPollers()
  res.json({ ok: true })
})

app.get('/api/energy', noCache, (_, res) => {
  res.json(store.energy ?? { source: 'unavailable' })
})

app.get('/api/abs', noCache, (_, res) => {
  res.json(store.absData ?? { source: 'unavailable' })
})

app.get('/api/vitals', noCache, (_, res) => {
  res.json(store.vitals ?? { source: 'unavailable' })
})

app.get('/api/flights', noCache, (_, res) => {
  res.json(store.flights ?? [])
})

app.get('/api/ships', noCache, (_, res) => {
  res.json(Object.values(store.ships ?? {}))
})

app.get('/api/fires', noCache, (_, res) => {
  res.json(store.fires ?? [])
})

app.get('/api/floods', noCache, (_, res) => {
  res.json(store.floods ?? [])
})

app.get('/api/seismic', noCache, (_, res) => {
  res.json(store.seismic ?? [])
})

app.get('/api/warnings', noCache, (_, res) => {
  res.json(store.warnings ?? [])
})

app.get('/api/threat-index', noCache, (_, res) => {
  res.json(store.threatIndex ?? null)
})

app.get('/api/road-closures', noCache, (_, res) => {
  res.json(store.roadClosures ?? [])
})

app.get('/api/port-congestion', noCache, (_, res) => {
  res.json(store.portCongestion ?? [])
})

app.get('/api/energy-outages', noCache, (_, res) => {
  res.json(store.energyOutages ?? { electricity: [], gas: [] })
})

app.get('/api/emergency-alerts', noCache, (_, res) => {
  res.json(store.emergencyAlerts ?? [])
})

app.get('/api/emergency-impact', noCache, (_, res) => {
  res.json(store.emergencyImpact ?? null)
})

app.get('/api/emergency-cross-check', noCache, (_, res) => {
  res.json(store.emergencyCrossCheck ?? null)
})

app.get('/api/cables', async (_, res) => {
  try {
    const data = await fetchCables()
    res.json(data)
  } catch (err) {
    console.error('[CABLES] Fetch failed:', err.message)
    res.status(503).json({ error: 'Cable data unavailable' })
  }
})

app.post('/api/force-brief', async (_, res) => {
  console.log('[API] Force AI brief triggered')
  const { generateAiBrief } = await import('./server/routes/aiBrief.js')
  const result = await generateAiBrief(store.news)
  if (result) {
    store.aiBrief = result
    broadcast('ai_brief', result)
    res.json({ ok: true, model: result.model })
  } else {
    res.status(503).json({ ok: false, error: 'No AI provider available' })
  }
})

/* ─────────────────────────────────────────────
   DATA POLLERS — replace mock with real APIs
───────────────────────────────────────────── */

/** Financial data — Yahoo Finance + RBA RSS + CoinGecko (Phase 3) */
async function fetchFinancial() {
  try {
    return await fetchRealFinancial(store.financial)
  } catch (err) {
    console.warn('[FIN] Falling back to mock:', err.message)
    return getMockFinancial()
  }
}

/** News aggregation — RSS feeds (Phase 5) */
async function fetchNews() {
  try {
    return await fetchRealNews()
  } catch (err) {
    console.warn('[NEWS] Falling back to mock:', err.message)
    return getMockNews()
  }
}

/** Weather — Open-Meteo (Phase 4) */
async function fetchWeather() {
  try {
    return await fetchRealWeather()
  } catch (err) {
    console.warn('[WEATHER] Falling back to mock:', err.message)
    return getMockWeather()
  }
}

async function runAllPollers() {
  const results = await Promise.allSettled([
    fetchFinancial(),
    fetchNews(),
    fetchWeather(),
  ])

  let online = 0

  // Financial
  if (results[0].status === 'fulfilled') {
    store.financial = { ...results[0].value, updatedAt: new Date().toISOString() }
    broadcast('financial', store.financial)
    online++
  }

  // News
  if (results[1].status === 'fulfilled') {
    const newItems = results[1].value.filter(
      item => !store.news.find(n => n.id === item.id)
    )
    if (newItems.length) {
      store.news = [...newItems, ...store.news].slice(0, 200)
      newItems.forEach(item => broadcast('news', item))
    }
    online++
  }

  // Weather
  if (results[2].status === 'fulfilled') {
    store.weather = results[2].value
    broadcast('weather', store.weather)
    online++
  }

  store.feedStats = computeFeedStats()
  broadcast('feedStats', store.feedStats)
  console.log(`[POLL] Cycle complete — ${online}/3 pollers OK`)
}

/* ─────────────────────────────────────────────
   POLLING SCHEDULE
───────────────────────────────────────────── */
const POLL_INTERVALS = {
  financial: 3  * 60 * 1000,  // 3 min
  news:      2  * 60 * 1000,  // 2 min
  full:      10 * 60 * 1000,  // 10 min full cycle
}

function startPolling() {
  setInterval(fetchFinancial, POLL_INTERVALS.financial)
  setInterval(async () => {
    const items = await fetchNews()
    const newItems = items.filter(i => !store.news.find(n => n.id === i.id))
    if (newItems.length) {
      store.news = [...newItems, ...store.news].slice(0, 200)
      newItems.forEach(item => broadcast('news', item))
    }
  }, POLL_INTERVALS.news)
  setInterval(runAllPollers, POLL_INTERVALS.full)
}

/* ─────────────────────────────────────────────
   SERVE STATIC REACT BUILD (production)
───────────────────────────────────────────── */
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'dist')
  app.use(express.static(distPath))
  app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')))
}

/* ─────────────────────────────────────────────
   BOOTSTRAPPING — load data BEFORE opening port
───────────────────────────────────────────── */
async function bootstrap() {
  console.log('🇦🇺 [BOOT] Australia Intelligence Monitor starting...')
  console.log('[BOOT 1/3] Loading financial data...')

  try { store.financial = await fetchFinancial() } catch (e) {
    console.warn('[BOOT] Financial load failed:', e.message)
  }

  console.log('[BOOT 2/3] Aggregating news feeds...')
  try { store.news = await fetchNews() } catch (e) {
    console.warn('[BOOT] News load failed:', e.message)
  }

  console.log('[BOOT 3/3] Fetching weather...')
  try { store.weather = await fetchWeather() } catch (e) {
    console.warn('[BOOT] Weather load failed:', e.message)
  }

  store.feedStats = computeFeedStats()
  startPolling()

  // Phase 2: live map data pollers
  startFlightsPoller(broadcast, store)
  startShipsWatcher(broadcast, store)
  startSeismicPoller(broadcast, store)
  startFiresPoller(broadcast, store)
  startFloodsPoller(broadcast, store)

  // Phase 3: real financial poller
  startFinancialPoller(broadcast, store)

  // Phase 4: real weather + FIDS
  startWeatherPoller(broadcast, store)
  startFidsPoller(broadcast, store)

  // Phase 5: AI brief (fires 30s after boot once news is loaded)
  startAiBriefPoller(broadcast, store)

  // Phase 6: AEMO energy grid + ABS national indicators
  startEnergyPoller(broadcast, store)
  startAbsPoller(broadcast, store)

  // Phase 7: Australian vitals — fire danger, air quality, reservoirs, GBR SST
  startVitalsPoller(broadcast, store)

  // Threat Level Index — composite score over seismic/weather/fire/flood/cyber, all already in store
  startThreatIndexPoller(broadcast, store)

  // NSW road closures/incidents/roadworks — TfNSW Open Data Hub (requires TRANSPORT_NSW_KEY)
  startRoadClosuresPoller(broadcast, store)

  // Port congestion — idle/anchored vessel counts near major seaports, derived from existing AIS ship data
  startPortCongestionPoller(broadcast, store)

  // Energy outages — AEMO electricity market notices (LOR/power system events) + east coast gas system notices
  startEnergyOutagesPoller(broadcast, store)

  // Emergency alerts — direct, official, per-state/territory agency incident feeds (RFS, CFA/EMV, QFES, CFS, DFES, TFS, ESA)
  startEmergencyAlertsPoller(broadcast, store)

  // Emergency impact — deterministic area/population estimate + AI narrative for severity>=2 alerts, independent slow poll
  startEmergencyImpactPoller(broadcast, store)

  // Emergency cross-check — validates the 7 direct agency feeds against EmergencyAPI.com's aggregation (diagnostic only)
  startEmergencyCrossCheckPoller(broadcast, store)

  // ✅ Only NOW open the port
  server.listen(PORT, () => {
    console.log(`✅ [READY] Server live → http://localhost:${PORT}`)
  })
}

bootstrap()

/* ─────────────────────────────────────────────
   MOCK DATA (remove once real APIs wired)
───────────────────────────────────────────── */
function getMockFinancial() {
  const base = 8234.50 + (Math.random() - 0.5) * 40
  return {
    asx200:       { value: +base.toFixed(2), change: +(base - 8262.65).toFixed(2), changePct: +((base - 8262.65) / 8262.65 * 100).toFixed(2) },
    audusd:       { value: 0.6471 + (Math.random() - 0.5) * 0.002, change: -0.0018 },
    gold:         { value: 4231 + Math.floor((Math.random() - 0.5) * 20), change: 8 },
    ironOre:      { value: 103.20, change: -2.40 },
    turnover:     { value: 6.24, unit: '$B', changeLabel: '+8.2% vs avg' },
    marginLending:{ value: '$42.3B', label: '+3.1% QoQ' },
    cashRate:     { value: '4.35%', label: 'RBA target' },
    crypto:       { btc: 98240 + Math.floor((Math.random() - 0.5) * 2000), eth: 5420, btcChange: 2.14, ethChange: -0.88 },
    sectors: [
      { name: 'Materials (Mining)',  pct: 24.1, val: '$1.48B' },
      { name: 'Financials (Banks)',  pct: 21.8, val: '$1.34B' },
      { name: 'Real Estate (REITs)',pct: 15.3, val: '$0.94B' },
      { name: 'Energy (LNG/Coal)',   pct: 12.7, val: '$0.78B' },
      { name: 'Health Care',         pct: 10.2, val: '$0.63B' },
      { name: 'Other',               pct: 15.9, val: '$0.97B' },
    ],
    netflowETF: [
      { name: 'VAS (Vanguard AU)', val: '+$38M', pos: true },
      { name: 'IOZ (iShares)',     val: '+$22M', pos: true },
      { name: 'STW (SPDR AU)',     val: '+$15M', pos: true },
      { name: 'GDX (Gold Miners)', val: '-$8M',  pos: false },
    ],
    foreignFlow: [
      { ticker: 'BHP', val: '+$82M', pos: true },
      { ticker: 'CBA', val: '+$55M', pos: true },
      { ticker: 'RIO', val: '+$41M', pos: true },
      { ticker: 'WBC', val: '-$28M', pos: false },
      { ticker: 'ANZ', val: '-$19M', pos: false },
    ],
    instFlow: [
      { ticker: 'CSL', val: '+$44M', pos: true },
      { ticker: 'WDS', val: '+$31M', pos: true },
      { ticker: 'MQG', val: '-$22M', pos: false },
      { ticker: 'WES', val: '-$12M', pos: false },
      { ticker: 'NAB', val: '-$9M',  pos: false },
    ],
  }
}

let _mockId = 100
function getMockNews() {
  return [
    { id: _mockId++, cat: 'defence',   source: 'DoD Australia',   origin: 'domestic', time: '3m ago',  text: 'RAAF F-35As complete joint exercise with USAF at Tindal — largest air combat training package in NT history' },
    { id: _mockId++, cat: 'economy',   source: 'AFR',             origin: 'domestic', time: '7m ago',  text: 'ASX 200 opens lower as iron ore futures slide on softer Chinese PMI data; BHP, RIO lead losses' },
    { id: _mockId++, cat: 'security',  source: 'ABC News',        origin: 'domestic', time: '11m ago', text: 'AFP and ASIO joint operation disrupts espionage network linked to foreign state actor; two charged' },
    { id: _mockId++, cat: 'pacific',   source: 'RNZ Pacific',     origin: 'overseas', time: '18m ago', text: 'Solomon Islands PM signals review of Chinese security agreement — Canberra welcomes dialogue' },
    { id: _mockId++, cat: 'cyber',     source: 'ACSC',            origin: 'domestic', time: '22m ago', text: 'ASD Advisory: Active exploitation of critical vulnerability in AU government software — patch immediately' },
    { id: _mockId++, cat: 'emergency', source: 'BOM',             origin: 'domestic', time: '29m ago', text: 'Severe Thunderstorm Warning — SE QLD including Brisbane, Gold Coast — damaging winds, large hail' },
    { id: _mockId++, cat: 'politics',  source: 'SMH',             origin: 'domestic', time: '34m ago', text: 'Senate Armed Services Committee grills Defence over AUKUS submarine cost blowout' },
    { id: _mockId++, cat: 'economy',   source: 'RBA',             origin: 'domestic', time: '41m ago', text: 'RBA Governor: inflation returning to target band — monitoring labour market ahead of August decision' },
  ]
}

function getMockWeather() {
  return [
    { name: 'Sydney',      region: 'NSW', temp: 22, desc: 'Partly cloudy', humidity: 62, wind: 15 },
    { name: 'Melbourne',   region: 'VIC', temp: 14, desc: 'Shower likely', humidity: 78, wind: 22 },
    { name: 'Brisbane',    region: 'QLD', temp: 28, desc: 'Sunny',         humidity: 55, wind: 12 },
    { name: 'Perth',       region: 'WA',  temp: 25, desc: 'Clear',         humidity: 48, wind: 18 },
    { name: 'Adelaide',    region: 'SA',  temp: 19, desc: 'Cloudy',        humidity: 70, wind: 20 },
    { name: 'Darwin',      region: 'NT',  temp: 33, desc: 'Humid/Hazy',   humidity: 82, wind: 9  },
    { name: 'Canberra',    region: 'ACT', temp: 11, desc: 'Clear & cold',  humidity: 55, wind: 8  },
    { name: 'Hobart',      region: 'TAS', temp: 8,  desc: 'Windy',        humidity: 85, wind: 35 },
    { name: 'Cairns',      region: 'QLD', temp: 31, desc: 'Sunny',         humidity: 74, wind: 11 },
    { name: 'Townsville',  region: 'QLD', temp: 30, desc: 'Hot',           humidity: 68, wind: 14 },
    { name: 'Alice Spgs',  region: 'NT',  temp: 26, desc: 'Dust haze',     humidity: 18, wind: 28 },
    { name: 'Port Hedland',region: 'WA',  temp: 35, desc: 'Sunny/Hot',    humidity: 41, wind: 25 },
  ]
}
