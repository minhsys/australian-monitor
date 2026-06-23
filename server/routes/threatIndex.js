const LEVELS = [
  { level: 0, name: 'GREEN',  label: 'Normal',   color: '#00e676' },
  { level: 1, name: 'BLUE',   label: 'Guarded',  color: '#00a8ff' },
  { level: 2, name: 'YELLOW', label: 'Elevated', color: '#f5c842' },
  { level: 3, name: 'ORANGE', label: 'High',     color: '#ff8c00' },
  { level: 4, name: 'RED',    label: 'Severe',   color: '#ff3d6b' },
]

const COMPUTE_MS = 60 * 1000
const RECENT_MS  = 24 * 60 * 60 * 1000

const FIRE_RATING_LEVEL = {
  catastrophic: 4, extreme: 3, severe: 3, 'very high': 2, high: 2,
  moderate: 1, 'low-moderate': 0, low: 0,
}

const SEVERE_WEATHER_RE  = /severe|cyclone|tsunami|extreme/i
const EMERGENCY_PHASE_RE = /emergency|warning/i
const MAJOR_FLOOD_RE     = /major|emergency/i
const CRITICAL_CYBER_RE  = /critical vulnerability|active exploitation|ransomware|zero-day|breach/i
const FUEL_SHORTAGE_RE   = /fuel shortage|petrol shortage|diesel shortage|fuel supply (disrupt|short)|refinery (shutdown|outage|fire)|rolling blackout|load shedding|blackout (hits|leaves|across)/i

function levelInfo(level) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))]
}

function scoreSeismic(seismic = []) {
  const now    = Date.now()
  const recent = seismic.filter(e => now - e.time < RECENT_MS)
  const maxMag = recent.reduce((m, e) => Math.max(m, e.magnitude || 0), 0)

  let level = 0
  if (maxMag >= 7)      level = 4
  else if (maxMag >= 6) level = 3
  else if (maxMag >= 5) level = 2
  else if (maxMag >= 4) level = 1

  const top = [...recent].sort((a, b) => b.magnitude - a.magnitude).slice(0, 5)
  return {
    level,
    summary: top.length ? `Max M${maxMag.toFixed(1)} — ${top[0].place}` : 'No significant seismic activity (24h)',
    sources: top.map(e => ({ type: 'seismic', id: e.id, time: e.time, label: `M${e.magnitude?.toFixed(1)} — ${e.place}` })),
  }
}

function scoreWeather(warnings = []) {
  const now    = Date.now()
  const active = warnings.filter(w => !w.expires || new Date(w.expires).getTime() > now)

  let level = active.length ? 1 : 0
  for (const w of active) {
    if (SEVERE_WEATHER_RE.test(w.type || '') || SEVERE_WEATHER_RE.test(w.title || '')) level = Math.max(level, 3)
    if (EMERGENCY_PHASE_RE.test(w.phase || '')) level = Math.max(level, 2)
  }
  if (active.length >= 5) level = Math.max(level, 2)

  return {
    level,
    summary: active.length ? `${active.length} active BOM warning(s)` : 'No active severe weather warnings',
    sources: active.slice(0, 5).map(w => ({ type: 'weather', id: w.id, time: w.issued, label: w.title })),
  }
}

function scoreFire(fires = [], fireDanger) {
  const ratings = fireDanger?.ratings ?? {}
  let level = 0
  let worstState = null
  for (const [state, rating] of Object.entries(ratings)) {
    const lvl = FIRE_RATING_LEVEL[String(rating).toLowerCase()] ?? 0
    if (lvl > level) { level = lvl; worstState = state }
  }

  const isHighConf  = f => String(f.confidence).toLowerCase() === 'h' || Number(f.confidence) >= 80
  const highConf    = fires.filter(isHighConf)
  const highConfHotspots = highConf.length
  if (highConfHotspots >= 50)      level = Math.max(level, 3)
  else if (highConfHotspots >= 15) level = Math.max(level, 2)
  else if (highConfHotspots >= 1)  level = Math.max(level, 1)

  const sources = []
  if (worstState) {
    sources.push({ type: 'fire_danger', id: worstState, label: `${worstState} fire danger: ${ratings[worstState]} (${fireDanger?.source ?? 'unknown'} source)` })
  }
  highConf.slice(0, 5).forEach((f, i) => {
    sources.push({ type: 'fire_hotspot', id: `${f.lat},${f.lon}-${i}`, time: f.date, label: `High-confidence hotspot @ ${f.lat?.toFixed(2)},${f.lon?.toFixed(2)}` })
  })

  return {
    level,
    summary: `${highConfHotspots} active high-confidence hotspot(s)${worstState ? ` · worst rating ${ratings[worstState]} (${worstState})` : ''}`,
    sources,
  }
}

function scoreFlood(floods = []) {
  const now    = Date.now()
  const active = floods.filter(f => !f.expires || new Date(f.expires).getTime() > now)

  let level = active.length ? 1 : 0
  for (const f of active) {
    if (MAJOR_FLOOD_RE.test(f.severity || '') || MAJOR_FLOOD_RE.test(f.phase || '')) level = Math.max(level, 3)
  }
  if (active.length >= 5) level = Math.max(level, 2)

  return {
    level,
    summary: active.length ? `${active.length} active flood warning(s)` : 'No active flood warnings',
    sources: active.slice(0, 5).map(f => ({ type: 'flood', id: f.id, time: f.issued, label: f.title })),
  }
}

function scoreCyber(news = []) {
  const now    = Date.now()
  const recent = news.filter(n => n.cat === 'cyber' && now - (n.timestamp || 0) < RECENT_MS)

  let level = 0
  if (recent.length >= 1) level = 1
  if (recent.length >= 3) level = 2
  if (recent.some(n => CRITICAL_CYBER_RE.test(n.text || ''))) level = Math.max(level, 3)

  return {
    level,
    summary: recent.length ? `${recent.length} cyber advisory item(s) (24h)` : 'No recent cyber advisories',
    sources: recent.slice(0, 5).map(n => ({ type: 'cyber_news', id: n.id, time: n.timestamp, label: n.text, url: n.url })),
  }
}

function scoreInfrastructure(roadClosures = [], portCongestion = []) {
  const closures  = roadClosures.filter(h => h.closure)
  const congested = portCongestion.filter(p => p.level >= 1)

  let roadLevel = closures.length ? 1 : 0
  if (closures.length >= 3) roadLevel = 2
  if (closures.length >= 6) roadLevel = 3

  const portLevel = congested.reduce((m, p) => Math.max(m, p.level), 0)
  const level     = Math.max(roadLevel, portLevel)

  const summaryParts = []
  if (closures.length)  summaryParts.push(`${closures.length} active NSW road closure(s)`)
  if (congested.length) summaryParts.push(`${congested.length} port(s) congested`)

  const sources = [
    ...closures.slice(0, 3).map(h => ({ type: 'road_closure', id: h.id, time: h.updated, label: `${h.road || h.suburb || 'Road'}: ${h.title}` })),
    ...[...congested].sort((a, b) => b.idleCount - a.idleCount).slice(0, 3)
      .map(p => ({ type: 'port_congestion', id: p.name, label: `${p.name}: ${p.idleCount} vessel(s) idle/anchored` })),
  ].slice(0, 5)

  return {
    level,
    summary: summaryParts.length ? summaryParts.join(' · ') : 'No active road closures or port congestion',
    sources,
  }
}

function scoreEnergy(electricityNotices = [], gasNotices = [], news = []) {
  const now = Date.now()

  const activeGas   = gasNotices.filter(n => !n.end || new Date(n.end).getTime() > now)
  const criticalGas = activeGas.filter(n => n.critical)

  const fuelNews = news.filter(n => now - (n.timestamp || 0) < RECENT_MS && FUEL_SHORTAGE_RE.test(n.text || ''))

  const noticeText = n => `${n.type ?? ''} ${n.label ?? ''}`

  let level = 0
  if (electricityNotices.length) level = 2
  if (electricityNotices.some(n => /LOR ?3|MARKET SUSPENSION/i.test(noticeText(n)))) level = Math.max(level, 4)
  else if (electricityNotices.some(n => /LOR ?2/i.test(noticeText(n))))             level = Math.max(level, 3)

  if (activeGas.length)   level = Math.max(level, 1)
  if (criticalGas.length) level = Math.max(level, 3)

  if (fuelNews.length)      level = Math.max(level, 1)
  if (fuelNews.length >= 3) level = Math.max(level, 2)

  const summaryParts = []
  if (electricityNotices.length) summaryParts.push(`${electricityNotices.length} AEMO electricity supply-risk notice(s)`)
  if (activeGas.length)          summaryParts.push(`${activeGas.length} active east coast gas notice(s)`)
  if (fuelNews.length)           summaryParts.push(`${fuelNews.length} fuel/blackout news item(s)`)

  const sources = [
    ...electricityNotices.slice(0, 3).map(n => ({ type: 'energy_electricity', id: n.id, time: n.issued, label: `${n.type}: ${n.label}` })),
    ...activeGas.slice(0, 2).map(n => ({ type: 'energy_gas', id: n.id, time: n.start, label: n.message, url: n.url })),
    ...fuelNews.slice(0, 2).map(n => ({ type: 'energy_news', id: n.id, time: n.timestamp, label: n.text, url: n.url })),
  ].slice(0, 5)

  return {
    level,
    summary: summaryParts.length ? summaryParts.join(' · ') : 'No active electricity/gas supply-risk notices',
    sources,
  }
}

function scoreEmergencyAlerts(alerts = []) {
  const bySeverityDesc    = [...alerts].sort((a, b) => b.severity - a.severity)
  const emergencyWarnings = alerts.filter(a => a.severity === 3)
  const watchAndAct       = alerts.filter(a => a.severity === 2)

  let level = alerts.length ? 1 : 0
  if (watchAndAct.length)       level = Math.max(level, 2)
  if (emergencyWarnings.length) level = Math.max(level, 3)
  if (alerts.length >= 20)      level = Math.max(level, 2)

  const summaryParts = []
  if (alerts.length)            summaryParts.push(`${alerts.length} active incident(s) across state agencies`)
  if (watchAndAct.length)       summaryParts.push(`${watchAndAct.length} Watch and Act`)
  if (emergencyWarnings.length) summaryParts.push(`${emergencyWarnings.length} Emergency Warning(s)`)

  return {
    level,
    summary: summaryParts.length ? summaryParts.join(' · ') : 'No active state emergency-agency incidents',
    sources: bySeverityDesc.slice(0, 5).map(a => ({
      type: 'emergency_alert', id: a.id, time: a.issued, label: `${a.state} ${a.agency}: ${a.title}`, url: a.url,
    })),
  }
}

export function computeThreatIndex(store) {
  const categories = {
    seismic:        scoreSeismic(store.seismic),
    weather:        scoreWeather(store.warnings),
    fire:           scoreFire(store.fires, store.vitals?.fireDanger),
    flood:          scoreFlood(store.floods),
    cyber:          scoreCyber(store.news),
    infrastructure: scoreInfrastructure(store.roadClosures, store.portCongestion),
    energy:         scoreEnergy(store.energyOutages?.electricity, store.energyOutages?.gas, store.news),
    emergencyAlerts: scoreEmergencyAlerts(store.emergencyAlerts),
  }

  const overallLevel = Math.max(0, ...Object.values(categories).map(c => c.level))
  const driver = Object.entries(categories).find(([, c]) => c.level === overallLevel)?.[0] ?? null

  return {
    overall:    { ...levelInfo(overallLevel), driver },
    categories,
    computedAt: new Date().toISOString(),
  }
}

export function startThreatIndexPoller(broadcast, store) {
  function compute() {
    const result = computeThreatIndex(store)
    store.threatIndex = result
    broadcast('threat_index', result)
    console.log(`[THREAT INDEX] ${result.overall.name} (driver: ${result.overall.driver ?? 'none'})`)
  }

  setTimeout(compute, 15_000)        // let other pollers populate the store first
  setInterval(compute, COMPUTE_MS)
}
