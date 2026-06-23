import fetch from 'node-fetch'

const POLL_MS       = 12 * 60 * 1000
const FIRST_POLL_MS = 30_000
const MAX_NARRATIVES_PER_POLL = 10
const NARRATIVE_SEVERITY_THRESHOLD = 2

/* Distance-to-capital-city banding — a simplified stand-in for ABS Remoteness Areas.
 * Not the real ABS boundary dataset (too heavy for this pass); densities are
 * order-of-magnitude approximations, not measured figures. */
const CAPITALS = [
  { name: 'Sydney',    lat: -33.87, lon: 151.21 },
  { name: 'Melbourne', lat: -37.81, lon: 144.96 },
  { name: 'Brisbane',  lat: -27.47, lon: 153.02 },
  { name: 'Perth',     lat: -31.95, lon: 115.86 },
  { name: 'Adelaide',  lat: -34.93, lon: 138.60 },
  { name: 'Darwin',    lat: -12.46, lon: 130.84 },
  { name: 'Canberra',  lat: -35.28, lon: 149.13 },
  { name: 'Hobart',    lat: -42.88, lon: 147.33 },
]

const REMOTENESS_BANDS = [
  { maxKm: 25,  class: 'Major City',     densityPerKm2: 1500 },
  { maxKm: 100, class: 'Inner Regional', densityPerKm2: 25 },
  { maxKm: 300, class: 'Outer Regional',  densityPerKm2: 3 },
  { maxKm: Infinity, class: 'Remote',     densityPerKm2: 0.2 },
]

const RADIUS_KM_BY_SEVERITY = { 0: 3, 1: 7, 2: 15, 3: 25 }

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function nearestCapitalDistanceKm(lat, lon) {
  return Math.min(...CAPITALS.map(c => haversineKm(lat, lon, c.lat, c.lon)))
}

function classifyRemoteness(distanceKm) {
  return REMOTENESS_BANDS.find(b => distanceKm <= b.maxKm)
}

export function estimateAreaImpact(alert) {
  const distanceKm = nearestCapitalDistanceKm(alert.lat, alert.lon)
  const band        = classifyRemoteness(distanceKm)
  const radiusKm    = RADIUS_KM_BY_SEVERITY[alert.severity] ?? RADIUS_KM_BY_SEVERITY[0]
  const areaKm2     = Math.PI * radiusKm ** 2

  return {
    areaKm2:           Math.round(areaKm2),
    populationEstimate: Math.round(areaKm2 * band.densityPerKm2),
    remotenessClass:    band.class,
    radiusKm,
  }
}

export function computeAggregateImpact(alerts = []) {
  const impacts = alerts.map(estimateAreaImpact)
  return {
    totalPeopleEstimate: impacts.reduce((sum, i) => sum + i.populationEstimate, 0),
    totalAreaKm2:        impacts.reduce((sum, i) => sum + i.areaKm2, 0),
    incidentCount:       alerts.length,
  }
}

/* ── AI narrative — same 3-provider fallback chain as aiBrief.js ── */

function buildPrompt(alert, impact) {
  return `You are assisting an Australian emergency-monitoring dashboard. Given one active incident, write ONE concise sentence (max 30 words) describing the likely infrastructure and traffic implications. Speak generally about the incident category/severity/location if you don't have specific local knowledge. Do NOT invent specific casualty, injury, or building-damage numbers — those are not known. Output only the sentence, no preamble.

Incident: ${alert.category} — severity ${alert.severity} — "${alert.title}", ${alert.state} (${alert.agency})
Status: ${alert.status ?? 'unknown'}
Estimated impact zone: ~${impact.areaKm2} km² (~${impact.populationEstimate} people, ${impact.remotenessClass})`
}

async function callGPT4o(prompt) {
  const key = process.env.GPT4O_KEY
  if (!key) throw new Error('GPT4O_KEY not set')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 80,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty OpenAI response')
  return text.trim()
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_KEY
  if (!key) throw new Error('GEMINI_KEY not set')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 80, temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(20_000),
    }
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini response')
  return text.trim()
}

async function callOpenRouter(prompt) {
  const key = process.env.OPENROUTER_KEY
  if (!key) throw new Error('OPENROUTER_KEY not set')
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemma-4-31b-it:free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 80,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty OpenRouter response')
  return text.trim()
}

export async function generateNarrative(alert, impact) {
  const prompt = buildPrompt(alert, impact)
  const [gpt, gemini, openrouter] = await Promise.allSettled([
    callGPT4o(prompt), callGemini(prompt), callOpenRouter(prompt),
  ])
  if (gpt.status        === 'fulfilled') return gpt.value
  if (gemini.status     === 'fulfilled') return gemini.value
  if (openrouter.status === 'fulfilled') return openrouter.value
  console.warn('[EMERGENCY IMPACT] All AI providers failed —', gpt.reason?.message, '/', gemini.reason?.message, '/', openrouter.reason?.message)
  return null
}

export function startEmergencyImpactPoller(broadcast, store) {
  const narrativeCache = new Map() // id -> { severity, status, narrative }

  async function poll() {
    const alerts = store.emergencyAlerts ?? []
    if (!alerts.length) {
      setTimeout(poll, POLL_MS)
      return
    }

    const aggregate = computeAggregateImpact(alerts)

    const highSeverity = [...alerts]
      .filter(a => a.severity >= NARRATIVE_SEVERITY_THRESHOLD)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, MAX_NARRATIVES_PER_POLL)

    const perIncident = await Promise.all(highSeverity.map(async alert => {
      const impact = estimateAreaImpact(alert)
      const cached = narrativeCache.get(alert.id)
      const narrative = cached && cached.severity === alert.severity && cached.status === alert.status
        ? cached.narrative
        : await generateNarrative(alert, impact)

      narrativeCache.set(alert.id, { severity: alert.severity, status: alert.status, narrative })
      return { id: alert.id, ...impact, narrative }
    }))

    store.emergencyImpact = { aggregate, perIncident, computedAt: new Date().toISOString() }
    broadcast('emergency_impact', store.emergencyImpact)
    console.log(`[EMERGENCY IMPACT] ~${aggregate.totalPeopleEstimate} people across ${aggregate.incidentCount} active incidents (${perIncident.length} narrative(s) generated)`)

    setTimeout(poll, POLL_MS)
  }

  setTimeout(poll, FIRST_POLL_MS)
}
