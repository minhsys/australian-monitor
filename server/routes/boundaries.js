import fetch from 'node-fetch'

// ABS ASGS2021 — public, no API key, CC BY 4.0 (https://geo.abs.gov.au/arcgis/rest/services/ASGS2021)
const ABS_BASE = 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021'
const STATE_CODE_RE = /^[1-9]$/

let stateCache = null
const sa2CacheByState = new Map()

async function queryGeoJSON(layerPath, where, outFields) {
  const params = new URLSearchParams({
    where, outFields,
    returnGeometry: 'true',
    f: 'geojson',
    resultRecordCount: '5000',
  })
  const res = await fetch(`${ABS_BASE}/${layerPath}/query?${params}`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`ABS boundary query HTTP ${res.status}`)
  const geojson = await res.json()
  if (geojson.error) throw new Error(`ABS boundary query error: ${geojson.error.message}`)
  return geojson
}

/** State/territory boundaries (generalized geometry) — fetched once, cached forever (static reference data). */
export async function fetchStateBoundaries() {
  if (stateCache) return stateCache
  stateCache = await queryGeoJSON('STE/FeatureServer/1', '1=1', 'state_code_2021,state_name_2021,area_albers_sqkm')
  return stateCache
}

/** SA2 (suburb-level) boundaries for one state, generalized geometry — cached per state after first fetch. */
export async function fetchSA2Boundaries(stateCode) {
  if (!STATE_CODE_RE.test(stateCode)) throw new Error('Invalid state code')
  if (sa2CacheByState.has(stateCode)) return sa2CacheByState.get(stateCode)
  const geojson = await queryGeoJSON(
    'SA2/FeatureServer/1',
    `state_code_2021='${stateCode}'`,
    'sa2_code_2021,sa2_name_2021,state_code_2021,area_albers_sqkm',
  )
  sa2CacheByState.set(stateCode, geojson)
  return geojson
}
