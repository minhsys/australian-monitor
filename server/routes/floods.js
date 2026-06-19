import fetch from 'node-fetch'

const BOM_WARNINGS_URL = 'https://api.weather.bom.gov.au/v1/warnings'
const POLL_MS = 10 * 60 * 1000

const FLOOD_TYPES = new Set(['flood_warning', 'flood_watch', 'flood_advice'])

/* Approximate midpoint coordinates for major Australian rivers */
const RIVER_COORDS = {
  // TAS
  'mersey':        [-41.55, 146.40],
  'north esk':     [-41.40, 147.15],
  'south esk':     [-41.50, 147.50],
  'derwent':       [-42.50, 146.50],
  'huon':          [-43.00, 147.00],
  'leven':         [-41.20, 145.80],
  'forth':         [-41.20, 146.20],
  'ringarooma':    [-41.10, 147.70],
  // NSW
  'hawkesbury':    [-33.50, 150.80],
  'hunter':        [-32.80, 151.40],
  'manning':       [-31.80, 152.30],
  'macquarie':     [-32.50, 148.00],
  'lachlan':       [-33.50, 147.00],
  'namoi':         [-30.50, 150.00],
  'gwydir':        [-29.50, 149.00],
  'murrumbidgee':  [-34.50, 146.00],
  'darling':       [-33.00, 143.00],
  'murray':        [-34.00, 139.00],
  'nepean':        [-33.70, 150.70],
  'bogan':         [-32.00, 147.50],
  'castlereagh':   [-31.50, 148.50],
  'peel':          [-30.80, 150.50],
  'clarence':      [-29.50, 152.80],
  'richmond':      [-28.90, 153.20],
  'tweed':         [-28.20, 153.50],
  'shoalhaven':    [-34.80, 150.40],
  'bellinger':     [-30.50, 152.50],
  'nambucca':      [-30.60, 152.90],
  // VIC
  'yarra':         [-37.80, 145.00],
  'maribyrnong':   [-37.80, 144.90],
  'latrobe':       [-38.20, 147.00],
  'mitchell':      [-37.70, 147.00],
  'thomson':       [-38.00, 146.50],
  'avoca':         [-36.80, 143.50],
  'loddon':        [-36.50, 144.00],
  'campaspe':      [-36.20, 144.60],
  'goulburn':      [-36.80, 145.50],
  'ovens':         [-36.60, 146.80],
  'kiewa':         [-36.40, 147.10],
  // QLD
  'brisbane':      [-27.50, 152.90],
  'fitzroy':       [-23.50, 150.50],
  'burdekin':      [-20.50, 147.00],
  'flinders':      [-20.00, 141.00],
  'barron':        [-16.90, 145.50],
  'mary':          [-26.00, 152.50],
  'condamine':     [-27.50, 151.50],
  'albert':        [-27.90, 153.00],
  'logan':         [-27.80, 153.00],
  'bremer':        [-27.60, 152.70],
  'lockyer':       [-27.60, 152.50],
  'don':           [-20.00, 148.30],
  'pioneer':       [-21.10, 149.00],
  'isaac':         [-22.00, 148.50],
  // SA
  'onkaparinga':   [-35.10, 138.70],
  'torrens':       [-34.90, 138.60],
  'cooper':        [-27.50, 141.00],
  'warburton':     [-28.00, 137.00],
  'finke':         [-25.50, 134.60],
  'light':         [-34.40, 138.80],
  'broughton':     [-33.60, 138.50],
  // WA
  'swan':          [-31.90, 115.90],
  'ord':           [-15.50, 128.50],
  'murchison':     [-26.50, 114.50],
  'gascoyne':      [-24.80, 113.80],
  'ashburton':     [-23.40, 115.30],
  'fortescue':     [-21.30, 116.10],
  'de grey':       [-20.20, 119.20],
  // NT
  'roper':         [-14.70, 133.00],
  'daly':          [-13.80, 130.80],
  'victoria':      [-15.20, 130.80],
  'katherine':     [-14.50, 132.30],
  'todd':          [-23.70, 133.90],
}

const STATE_COORDS = {
  TAS: [-42.0, 146.5],
  NSW: [-32.0, 146.0],
  VIC: [-37.0, 144.0],
  QLD: [-22.0, 144.0],
  SA:  [-30.0, 135.0],
  WA:  [-25.0, 122.0],
  NT:  [-19.0, 133.0],
  ACT: [-35.3, 149.1],
}

function findCoords(title, state) {
  const lower = title.toLowerCase()
  for (const [name, coords] of Object.entries(RIVER_COORDS)) {
    if (lower.includes(name)) return coords
  }
  return STATE_COORDS[state] ?? [-25, 133]
}

function parseWarnings(data) {
  const now = Date.now()
  return (data || [])
    .filter(w => FLOOD_TYPES.has(w.type) && new Date(w.expiry_time).getTime() > now)
    .map(w => {
      const [lat, lon] = findCoords(w.title, w.state)
      return {
        id:       w.id,
        title:    w.title,
        state:    (w.states ?? [w.state]).join(', '),
        type:     w.type,
        severity: w.warning_group_type ?? 'minor',
        phase:    w.phase,
        issued:   w.issue_time,
        expires:  w.expiry_time,
        lat,
        lon,
      }
    })
}

export function startFloodsPoller(broadcast, store) {
  async function poll() {
    try {
      const res = await fetch(BOM_WARNINGS_URL, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error(`BOM warnings HTTP ${res.status}`)
      const json   = await res.json()
      const floods = parseWarnings(json.data)
      store.floods = floods
      broadcast('floods', floods)
      console.log(`[FLOODS] ${floods.length} active warnings from BOM`)
    } catch (err) {
      console.warn('[FLOODS] Poll failed:', err.message)
    }
  }

  poll()
  setInterval(poll, POLL_MS)
}
