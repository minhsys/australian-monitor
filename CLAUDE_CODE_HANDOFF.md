# Australia Intelligence Monitor — Claude Code Handoff

## Project
Real-time Australian geopolitical & strategic intelligence dashboard.
Modelled on vietnam-intelligence-monitor. Stack confirmed from source author.

**GitHub:** https://github.com/minhsys/australian-monitor.git

---

## Tech Stack (locked — do not change)
- **Frontend:** React 18 + Vite + Leaflet.js + Lucide Icons + custom CSS
- **Backend:** Node.js + Express + WebSocket (`ws`)
- **AI:** GPT-4o + Gemini 2.5-flash (parallel race via Promise.allSettled)
- **Deploy:** Docker → Render.com
- **Map:** Leaflet with CartoDB Dark Matter tiles (NOT MapLibre, NOT Google Maps)

---

## Current State — Phase 1 COMPLETE (mock data only)

### What exists and works
```
australia-monitor/
├── package.json               ← all deps including leaflet, ws, express
├── vite.config.js             ← proxy /api → :3001
├── index.html                 ← clean, no CDN deps
├── server.js                  ← Express + WebSocket + bootstrapping + mock data
├── Dockerfile + render.yaml
├── .env.example
└── src/
    ├── main.jsx
    ├── App.jsx                ← 3-col layout, WS client, REST polling
    ├── styles/cyberpunk-au.css  ← full dark theme
    └── components/
        ├── Header.jsx         ← title, AEST clock, feed status
        ├── LeftSidebar.jsx    ← Monitor Control + 12-city BOM weather grid
        ├── MapCenter.jsx      ← Leaflet map + overlay controls + bottom tabs
        ├── RightSidebar.jsx   ← ASX 200, sparkline, sectors, buy/sell tables
        ├── BottomTicker.jsx   ← scrolling live signals strip
        └── panels/
            ├── MapOverlayControls.jsx  ← 12-layer checkbox panel
            └── NewsPanel.jsx           ← AI desk, search, filters, news list
```

### Layout (matches Vietnam Intelligence Monitor screenshot)
- **Header:** Full-width, title + AEST clock + feed status
- **Left sidebar (230px):** Monitor Control box + 12-city weather grid (2-col)
- **Center:** Leaflet map (upper ~60%) + tab panel NEWS/TRANSPORT/WARNING (lower ~40%)
- **Right sidebar (330px):** ASX 200 hero + sparkline + 3 tabs (Money Flow / Sectors / RBA & Macro)
- **Bottom ticker:** Scrolling live signals strip

### Map layers (currently static mock markers)
- News cluster markers (colored circles with counts) for: Sydney(48), Melbourne(31), Canberra(28), Brisbane(19), Perth(12), Darwin(7), Adelaide(5), Cairns(5), PNG(3), Honiara(2)
- Intelligence hub dots: Pine Gap, RAAF Tindal/Williamtown/Amberley/Pearce, HMAS Stirling/Kuttabul, Harold Holt, JORN

### Known fixed bugs (apply these if not already in repo)
1. `MapCenter.jsx` — must use `import L from 'leaflet'` (static), NOT `import('leaflet').then(...)`
2. `MapCenter.jsx` — must include `import 'leaflet/dist/leaflet.css'`
3. `#au-map` CSS — must use `position: absolute; top:0; left:0; right:0; bottom:0` NOT `height: 100%`

---

## Environment Variables (.env)
```
PORT=3001
NODE_ENV=development

# Phase 5 (AI news brief)
GPT4O_KEY=
GEMINI_KEY=

# Phase 2 (map layers)
AISSTREAM_KEY=        # free at aisstream.io
NASA_FIRMS_KEY=       # free at firms.modaps.eosdis.nasa.gov

# Phase 3 (financial)
NSW_FUEL_API_KEY=

# Phase 4 (FIDS)
AIRLABS_KEY=
```

---

## Next Steps — Phase 2: Live Map Layers

This is the immediate next phase. Wire up real data to replace mock markers.

### Task 2.1 — OpenSky live flights
**File:** `server/routes/flights.js` (create this)
**Endpoint:** `GET https://opensky-network.org/api/states/all?lamin=-44&lamax=-10&lomin=112&lomax=154`
- No API key needed for public access (400 req/day limit)
- Returns JSON with `states` array: `[icao24, callsign, origin_country, lon, lat, alt, velocity, heading, ...]`
- Poll every 8 seconds
- Broadcast via WebSocket: `{ type: 'flights', payload: [...] }`
- In `MapCenter.jsx`: render as cyan airplane `L.divIcon` rotated to `heading` degrees
- Filter: only show `origin_country === 'Australia'` OR within AU bounding box

### Task 2.2 — AIS ship tracking
**File:** `server/routes/ships.js` (create this)
**Endpoint:** `wss://stream.aisstream.io/v0/stream` (free API key from aisstream.io)
- Send subscription message on connect:
```json
{
  "APIKey": "YOUR_KEY",
  "BoundingBoxes": [[[-44, 112], [-10, 154]]],
  "FiltersShipMMSI": [],
  "FilterMessageTypes": ["PositionReport"]
}
```
- Parse `MessageType === "PositionReport"` → extract lat, lon, mmsi, ship name, speed
- Relay to frontend via WebSocket: `{ type: 'ships', payload: { mmsi, lat, lon, name, speed } }`
- Render as ship icons on the map (green = cargo, orange = tanker, cyan = RAN)

### Task 2.3 — Geoscience Australia seismic
**File:** `server/routes/seismic.js` (create this)
**Endpoint:** `https://earthquakes.ga.gov.au/geojson/2.0/query?minmagnitude=2.5&orderby=time&limit=50`
- Poll every 5 minutes
- GeoJSON FeatureCollection → extract magnitude, depth, place, time
- Render as red pulse circles scaled by magnitude

### Task 2.4 — NASA FIRMS bushfire hotspots
**File:** `server/routes/fires.js` (create this)
**Endpoint:** `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{NASA_FIRMS_KEY}/VIIRS_SNPP_NRT/-44,112,-10,154/1`
- Poll every 10 minutes
- Returns CSV: latitude, longitude, brightness, confidence, acq_date, acq_time
- Parse CSV, broadcast: `{ type: 'fires', payload: [...] }`
- Render as orange fire icons, size scaled by brightness

### Task 2.5 — Wire layers into MapCenter
In `MapCenter.jsx`, add `useEffect` hooks that listen to WS messages of type `flights`, `ships`, `seismic`, `fires` and update corresponding `L.layerGroup` instances. Toggle visibility when the overlay checkbox changes.

---

## Phase 3 (after Phase 2) — Financial Data

### ASX 200 & Markets
- `GET https://query1.finance.yahoo.com/v8/finance/chart/%5EAXJO` → current ASX 200
- `GET https://www.rba.gov.au/rss/rss-cb-exchange-rates.xml` → AUD/USD, AUD/JPY, AUD/CNY (parse XML)
- `GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=aud` → BTC, ETH

Replace mock data in `server.js` `getMockFinancial()` with real API calls. Poll every 3 minutes.

---

## Phase 4 (after Phase 3) — Weather & FIDS

### BOM Weather (12 cities)
- `GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m`
- No key needed. Poll every 15 minutes.
- Cities + coords: Sydney(-33.87,151.21), Melbourne(-37.81,144.97), Brisbane(-27.47,153.02), Perth(-31.95,115.86), Adelaide(-34.93,138.60), Darwin(-12.46,130.84), Canberra(-35.28,149.13), Hobart(-42.88,147.33), Cairns(-16.92,145.77), Townsville(-19.26,146.81), Alice Springs(-23.70,133.88), Port Hedland(-20.31,118.58)

### FIDS (Airport flight board)
- `GET https://airlabs.co/api/v9/schedules?dep_iata=SYD&api_key={AIRLABS_KEY}`
- Free tier: 1,000 req/month
- Airports: SYD, MEL, BNE, PER, DRW, ADL, HBA, CNS

---

## Phase 5 (after Phase 4) — AI News Brief

### RSS Feed Aggregation
Install `rss-parser`. 25+ Australian feeds to aggregate:
```js
const AU_FEEDS = [
  'https://www.abc.net.au/news/feed/51120/rss.xml',          // ABC News
  'https://www.smh.com.au/rss/feed.xml',                     // SMH
  'https://www.afr.com/rss',                                  // AFR
  'https://www.theaustralian.com.au/feed',                    // The Australian
  'https://rss.app/feeds/XXXXXX.xml',                         // ASPI Strategist (via rss.app)
  'https://www.defence.gov.au/news-events/releases/rss.xml',  // DoD Australia
  'https://www.asio.gov.au/news.rss',                         // ASIO
  'https://feeds.rnz.co.nz/pacific',                          // RNZ Pacific
  // ... add more
]
```

### Dual AI brief (GPT-4o + Gemini 2.5-flash)
Race both in parallel, use whichever resolves first:
```js
const [gpt, gemini] = await Promise.allSettled([
  callGPT4o(headlines),
  callGemini(headlines)
])
const brief = gpt.status === 'fulfilled' ? gpt.value
             : gemini.status === 'fulfilled' ? gemini.value
             : 'Brief unavailable'
```
Generate every 15 minutes. Push to frontend via WebSocket: `{ type: 'ai_brief', payload: brief }`

---

## Phase 6 — Submarine Cable + Finance Map Layers

### Submarine Cables (TeleGeography — FREE, no key)
```
Cable routes:    https://www.submarinecablemap.com/api/v3/cable/cable-geo.json
Landing points:  https://www.submarinecablemap.com/api/v3/landing-point/landing-point-geo.json
```
- Fetch once at startup, cache for 24h
- Filter to AU-relevant cables (those landing in AU)
- Render as coloured Leaflet polylines + pulsing circle markers at landing stations

### Finance Map Layer
Static GeoJSON markers (already designed in blueprint):
- ASX Sydney: -33.868, 151.207
- RBA Sydney: -33.868, 151.213
- Commodity hubs: Port Hedland(-20.315,118.577), Curtis Island LNG(-23.856,151.254), Kalgoorlie gold(-30.750,121.466), Newcastle coal(-32.913,151.796), Pilgangoora lithium(-21.715,118.670)
- Top 5 ASX company HQs: BHP(-37.820,144.964), CBA(-33.868,151.213), Rio Perth(-31.956,115.860)

---

## Blueprint Reference
Full v3 blueprint (all layers, APIs, design decisions) is in the repo as `australia-monitor-blueprint-v3.md` or available in this conversation history.

## Monthly Cost Target
~$24/month: Render.com $7 + GPT-4o ~$14 + Gemini ~$3. All data APIs free.
