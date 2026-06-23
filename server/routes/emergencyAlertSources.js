import Parser from 'rss-parser'

/* Direct, official, per-agency public feeds — no API key needed for any of these.
 * Each fetchX() retrieves raw data; each parseX() is a pure function (no I/O),
 * kept separate so it can be unit tested against fixture data without network mocking. */

const NSW_RFS_URL      = 'https://www.rfs.nsw.gov.au/feeds/majorIncidents.json'
const VIC_EMV_URL       = 'https://data.emergency.vic.gov.au/Show?pageId=getIncidentJSON'
const QLD_QFES_URL      = 'https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json'
const SA_CFS_URL        = 'https://data.eso.sa.gov.au/prod/cfs/criimson/cfs_current_incidents.json'
const WA_DFES_INCIDENTS_URL = 'https://api.emergency.wa.gov.au/v1/rss/incidents'
const WA_DFES_WARNINGS_URL  = 'https://api.emergency.wa.gov.au/v1/rss/warnings'
const TAS_TFS_URL       = 'https://www.fire.tas.gov.au/Show?pageId=bfKml'
const ACT_ESA_URL       = 'https://esa.act.gov.au/feeds/currentincidents.xml'

const FETCH_TIMEOUT_MS = 10_000

const rssParser = new Parser({
  customFields: {
    item: [
      ['georss:point', 'georssPoint'],
      ['geo:lat',      'geoLat'],
      ['geo:long',     'geoLong'],
      ['type',         'esaType'],
      ['agency',       'esaAgency'],
      ['resourceStatus', 'resourceStatus'],
      ['cadid',        'cadid'],
    ],
  },
})

/* ── Shared normalizers ── */

const SEVERITY_PATTERNS = [
  { level: 3, re: /emergency warning/i },
  { level: 2, re: /watch\s*and\s*act/i },
  { level: 1, re: /\badvice\b|monitor conditions/i },
]

export function normalizeSeverity(text = '') {
  for (const { level, re } of SEVERITY_PATTERNS) {
    if (re.test(text)) return level
  }
  return 0
}

const CATEGORY_PATTERNS = [
  { category: 'fire',    re: /fire|bushfire|burn|blaze|grass|scrub|hazard reduction/i },
  { category: 'flood',   re: /flood/i },
  { category: 'storm',   re: /storm|cyclone|tornado|severe weather/i },
  { category: 'hazmat',  re: /hazmat|chemical|electrical|gas leak|power line|spill/i },
  { category: 'medical', re: /ambulance|medical|rescue/i },
]

export function normalizeCategory(...parts) {
  const text = parts.filter(Boolean).join(' ')
  for (const { category, re } of CATEGORY_PATTERNS) {
    if (re.test(text)) return category
  }
  return 'other'
}

function makeIncident({ id, state, agency, category, title, status, severity, lat, lon, issued, url }) {
  return {
    id:       String(id ?? `${state}-${lat}-${lon}`),
    state,
    agency,
    category,
    title:    title || `${agency} incident`,
    status:   status || null,
    severity: severity ?? 0,
    lat:      Number(lat),
    lon:      Number(lon),
    issued:   issued || null,
    url:      url || null,
  }
}

const hasValidCoords = i => Number.isFinite(i.lat) && Number.isFinite(i.lon)

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json()
}

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.text()
}

/* ── NSW RFS (GeoJSON; geometry can be a GeometryCollection mixing a Point + a perimeter Polygon) ── */

function extractPoint(geometry) {
  if (!geometry) return null
  if (geometry.type === 'Point') return geometry.coordinates
  if (geometry.type === 'GeometryCollection') {
    for (const g of geometry.geometries ?? []) {
      const point = extractPoint(g)
      if (point) return point
    }
  }
  return null
}

function fieldFromHtml(html, label) {
  return html.match(new RegExp(`${label}\\s*:\\s*([^<]+)`, 'i'))?.[1]?.trim()
}

export function parseNswRfs(geojson) {
  return (geojson?.features ?? [])
    .map(f => {
      const [lon, lat] = extractPoint(f.geometry) ?? []
      const desc = f.properties?.description ?? ''
      return makeIncident({
        id:       f.properties?.guid ?? f.id,
        state:    'NSW',
        agency:   'RFS',
        category: normalizeCategory(fieldFromHtml(desc, 'TYPE'), f.properties?.category, f.properties?.title),
        title:    f.properties?.title,
        status:   fieldFromHtml(desc, 'STATUS'),
        severity: normalizeSeverity(fieldFromHtml(desc, 'ALERT LEVEL') ?? ''),
        lat, lon,
        issued:   f.properties?.pubDate,
        url:      f.properties?.link ?? f.properties?.guid,
      })
    })
    .filter(hasValidCoords)
}

export async function fetchNswRfs() {
  return parseNswRfs(await fetchJson(NSW_RFS_URL))
}

/* ── VIC (combined CFA / VICSES / DELWP incidents feed) ── */

export function parseVicEmergency(json) {
  return (json?.results ?? [])
    .filter(r => !/test prod record|do not dele/i.test(r.name || ''))
    .map(r => makeIncident({
      id:       `vic-${r.incidentNo}`,
      state:    'VIC',
      agency:   r.agency || r.territory || 'EMV',
      category: normalizeCategory(r.incidentType, r.category1, r.category2),
      title:    (r.name && r.name.trim()) || r.incidentLocation,
      status:   r.incidentStatus,
      severity: 0, // feed carries no graded Advice/Watch-and-Act/Emergency-Warning vocabulary
      lat:      r.latitude,
      lon:      r.longitude,
      issued:   r.originDateTime,
    }))
    .filter(hasValidCoords)
}

export async function fetchVicEmergency() {
  return parseVicEmergency(await fetchJson(VIC_EMV_URL))
}

/* ── QLD QFES (GeoJSON; properties already carry WGS84 Latitude/Longitude alongside the EPSG:3857 geometry) ── */

export function parseQldQfes(geojson) {
  return (geojson?.features ?? [])
    .map(f => {
      const p = f.properties ?? {}
      return makeIncident({
        id:       p.UniqueID,
        state:    'QLD',
        agency:   'QFES',
        category: normalizeCategory(p.GroupedType, p.EventType),
        title:    p.WarningArea ? `${p.WarningLevel} — ${p.WarningArea}` : p.WarningTitle,
        status:   p.CurrentStatus,
        severity: normalizeSeverity(p.WarningLevel ?? ''),
        lat:      p.Latitude,
        lon:      p.Longitude,
        issued:   p.ItemDateTimeLocal_ISO,
      })
    })
    .filter(hasValidCoords)
}

export async function fetchQldQfes() {
  return parseQldQfes(await fetchJson(QLD_QFES_URL))
}

/* ── SA CFS ── */

export function parseSaCfs(json) {
  return (Array.isArray(json) ? json : [])
    .map(r => {
      const [lat, lon] = (r.Location || '').split(',').map(Number)
      return makeIncident({
        id:       r.IncidentNo,
        state:    'SA',
        agency:   'CFS',
        category: normalizeCategory(r.Type),
        title:    [r.Type, r.Location_name].filter(Boolean).join(' — '),
        status:   r.Status,
        severity: 0, // feed carries no graded Advice/Watch-and-Act/Emergency-Warning vocabulary
        lat, lon,
        issued:   r.Date && r.Time ? `${r.Date} ${r.Time}` : null,
        url:      r.Message_link,
      })
    })
    .filter(hasValidCoords)
}

export async function fetchSaCfs() {
  return parseSaCfs(await fetchJson(SA_CFS_URL))
}

/* ── WA DFES (two RSS feeds: general incidents + graded warnings; same shape) ── */

export function parseWaItems(items) {
  return (items ?? [])
    .map(item => {
      const title = (item.title || '').replace(/\s*\([^)]*\)\s*$/, '').trim()
      return makeIncident({
        id:       item.guid,
        state:    'WA',
        agency:   'DFES',
        category: normalizeCategory(title),
        title,
        severity: normalizeSeverity(item.title || ''),
        lat:      Number(item.geoLat),
        lon:      Number(item.geoLong),
        issued:   item.pubDate,
        url:      item.link,
      })
    })
    .filter(hasValidCoords)
}

export async function fetchWaDfes() {
  const [incidentsXml, warningsXml] = await Promise.all([
    fetchText(WA_DFES_INCIDENTS_URL),
    fetchText(WA_DFES_WARNINGS_URL),
  ])
  const [incidents, warnings] = await Promise.all([
    rssParser.parseString(incidentsXml),
    rssParser.parseString(warningsXml),
  ])
  return [...parseWaItems(incidents.items), ...parseWaItems(warnings.items)]
}

/* ── TAS TFS (KML; alert level comes from styleUrl, not the description text;
 *   coordinates are written lat,lon — the reverse of the KML-standard lon,lat order,
 *   confirmed by cross-checking against known incident locations) ── */

const TAS_PLACEMARK_RE = /<Placemark id="(\d+)">([\s\S]*?)<\/Placemark>/g
const TAS_STYLE_SEVERITY = { emergencyWarningStyle: 3, watchAndActStyle: 2, adviceStyle: 1 }

function decodeEntities(str = '') {
  return str
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;|&#034;/g, '"').replace(/&apos;|&#039;/g, "'")
    .replace(/&amp;/g, '&')
}

function tasField(html, label) {
  return html.match(new RegExp(`${label}</th><td[^>]*>(?:<img[^>]*/>)?([^<]*)</td>`, 'i'))?.[1]?.trim()
}

export function parseTasTfs(kmlText) {
  const incidents = []
  for (const m of (kmlText ?? '').matchAll(TAS_PLACEMARK_RE)) {
    const [, id, block] = m
    const name    = block.match(/<name>([^<]*)<\/name>/)?.[1]?.trim()
    const desc    = decodeEntities(block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? '')
    const styleId = block.match(/<styleUrl>#(\w+)<\/styleUrl>/)?.[1]
    const [lat, lon] = (block.match(/<coordinates>([^<]*)<\/coordinates>/)?.[1] ?? '').split(',').map(Number)

    incidents.push(makeIncident({
      id,
      state:    'TAS',
      agency:   'TFS',
      category: normalizeCategory(tasField(desc, 'Type'), name),
      title:    name,
      status:   tasField(desc, 'Status'),
      severity: TAS_STYLE_SEVERITY[styleId] ?? 0,
      lat, lon,
      issued:   tasField(desc, 'First Report'),
      url:      `https://www.fire.tas.gov.au/i/${id}`,
    }))
  }
  return incidents.filter(hasValidCoords)
}

export async function fetchTasTfs() {
  return parseTasTfs(await fetchText(TAS_TFS_URL))
}

/* ── ACT ESA (GeoRSS; covers all agencies — fire, ambulance, hazmat — not just fire) ── */

export function parseActEsa(items) {
  return (items ?? [])
    .map(item => {
      const [lat, lon] = (item.georssPoint || '').trim().split(/\s+/).map(Number)
      return makeIncident({
        id:       item.cadid ?? item.guid,
        state:    'ACT',
        agency:   item.esaAgency || 'ESA', // esaAgency is the responding department (Fire/Ambulance/...), not a hazard category
        category: normalizeCategory(item.esaType, item.title),
        title:    item.title,
        status:   item.resourceStatus,
        severity: 0, // feed carries no graded Advice/Watch-and-Act/Emergency-Warning vocabulary
        lat, lon,
        issued:   item.pubDate,
        url:      item.link,
      })
    })
    .filter(hasValidCoords)
}

export async function fetchActEsa() {
  const feed = await rssParser.parseString(await fetchText(ACT_ESA_URL))
  return parseActEsa(feed.items)
}
