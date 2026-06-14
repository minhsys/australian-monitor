import fetch from 'node-fetch'

const CABLE_GEO_URL   = 'https://www.submarinecablemap.com/api/v3/cable/cable-geo.json'
const LANDING_GEO_URL = 'https://www.submarinecablemap.com/api/v3/landing-point/landing-point-geo.json'
const CACHE_TTL_MS    = 24 * 60 * 60 * 1000

const AU_BBOX = { minLat: -44, maxLat: -10, minLon: 112, maxLon: 154 }

let cache   = null
let cacheAt = 0

function inAU(lat, lon) {
  return lat >= AU_BBOX.minLat && lat <= AU_BBOX.maxLat &&
         lon >= AU_BBOX.minLon && lon <= AU_BBOX.maxLon
}

function coordsHaveAU(coords) {
  if (!Array.isArray(coords)) return false
  if (typeof coords[0] === 'number') return inAU(coords[1], coords[0])
  return coords.some(c => coordsHaveAU(c))
}

function cableIsAURelevant(feature) {
  return coordsHaveAU(feature.geometry?.coordinates)
}

export async function fetchCables() {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache

  console.log('[CABLES] Fetching TeleGeography data…')
  const [cablesRes, landingsRes] = await Promise.all([
    fetch(CABLE_GEO_URL),
    fetch(LANDING_GEO_URL),
  ])

  if (!cablesRes.ok)   throw new Error(`Cables API ${cablesRes.status}`)
  if (!landingsRes.ok) throw new Error(`Landings API ${landingsRes.status}`)

  const cablesGeo   = await cablesRes.json()
  const landingsGeo = await landingsRes.json()

  const auCables = {
    ...cablesGeo,
    features: cablesGeo.features.filter(cableIsAURelevant),
  }

  const auLandings = {
    ...landingsGeo,
    features: landingsGeo.features.filter(f => {
      const [lon, lat] = f.geometry.coordinates
      return inAU(lat, lon)
    }),
  }

  console.log(`[CABLES] ${auCables.features.length} AU cables, ${auLandings.features.length} landing points`)
  cache   = { cables: auCables, landings: auLandings }
  cacheAt = Date.now()
  return cache
}
