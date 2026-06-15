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
import { fetchRealFinancial, startFinancialPoller }  from './server/routes/financial.js'
import { fetchRealWeather, startWeatherPoller }       from './server/routes/weather.js'
import { startFidsPoller }                            from './server/routes/fids.js'
import { fetchRealNews }                              from './server/routes/news.js'
import { startAiBriefPoller }                         from './server/routes/aiBrief.js'
import { fetchCables }                                from './server/routes/cables.js'
import { fetchRealEnergy, startEnergyPoller }         from './server/routes/energy.js'
import { fetchAbsData, startAbsPoller }               from './server/routes/abs.js'
import { startVitalsPoller }                          from './server/routes/vitals.js'

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
  feedStats: { total: 18, online: 0, totalFeeds: 400 },
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
  if (store.news.length)  ws.send(JSON.stringify({ type: 'news_batch', payload: store.news.slice(0, 20) }))
  if (store.financial)    ws.send(JSON.stringify({ type: 'financial',  payload: store.financial }))
  if (store.feedStats)    ws.send(JSON.stringify({ type: 'feedStats',  payload: store.feedStats }))
  if (store.weather)      ws.send(JSON.stringify({ type: 'weather',    payload: store.weather }))
  if (store.aiBrief)      ws.send(JSON.stringify({ type: 'ai_brief',   payload: store.aiBrief }))
  if (store.energy)       ws.send(JSON.stringify({ type: 'energy',     payload: store.energy }))
  if (store.absData)      ws.send(JSON.stringify({ type: 'abs_data',   payload: store.absData }))
  if (store.vitals)       ws.send(JSON.stringify({ type: 'vitals',     payload: store.vitals }))
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
  res.json({ items: store.news.slice(0, 50) })
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
    online++
  }

  store.feedStats.online = online + 9 // base sources always up
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

  store.feedStats.online = 12
  startPolling()

  // Phase 2: live map data pollers
  startFlightsPoller(broadcast)
  startShipsWatcher(broadcast)
  startSeismicPoller(broadcast)
  startFiresPoller(broadcast)

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
    { id: _mockId++, cat: 'defence',   source: 'DoD Australia',   time: '3m ago',  text: 'RAAF F-35As complete joint exercise with USAF at Tindal — largest air combat training package in NT history' },
    { id: _mockId++, cat: 'economy',   source: 'AFR',             time: '7m ago',  text: 'ASX 200 opens lower as iron ore futures slide on softer Chinese PMI data; BHP, RIO lead losses' },
    { id: _mockId++, cat: 'security',  source: 'ABC News',        time: '11m ago', text: 'AFP and ASIO joint operation disrupts espionage network linked to foreign state actor; two charged' },
    { id: _mockId++, cat: 'pacific',   source: 'RNZ Pacific',     time: '18m ago', text: 'Solomon Islands PM signals review of Chinese security agreement — Canberra welcomes dialogue' },
    { id: _mockId++, cat: 'cyber',     source: 'ACSC',            time: '22m ago', text: 'ASD Advisory: Active exploitation of critical vulnerability in AU government software — patch immediately' },
    { id: _mockId++, cat: 'emergency', source: 'BOM',             time: '29m ago', text: 'Severe Thunderstorm Warning — SE QLD including Brisbane, Gold Coast — damaging winds, large hail' },
    { id: _mockId++, cat: 'politics',  source: 'SMH',             time: '34m ago', text: 'Senate Armed Services Committee grills Defence over AUKUS submarine cost blowout' },
    { id: _mockId++, cat: 'economy',   source: 'RBA',             time: '41m ago', text: 'RBA Governor: inflation returning to target band — monitoring labour market ahead of August decision' },
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
