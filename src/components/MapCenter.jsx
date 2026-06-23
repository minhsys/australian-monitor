import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import MapOverlayControls from './panels/MapOverlayControls.jsx'
import NewsPanel from './panels/NewsPanel.jsx'

/* ── Static data ── */
const NEWS_CLUSTERS = [
  { id: 'SYD', name: 'Sydney',       lat: -33.87, lon: 151.21, count: 48, level: 'high' },
  { id: 'MEL', name: 'Melbourne',    lat: -37.81, lon: 144.96, count: 31, level: 'high' },
  { id: 'BNE', name: 'Brisbane',     lat: -27.47, lon: 153.02, count: 19, level: 'medium' },
  { id: 'PER', name: 'Perth',        lat: -31.95, lon: 115.86, count: 12, level: 'medium' },
  { id: 'CBR', name: 'Canberra',     lat: -35.28, lon: 149.13, count: 28, level: 'high' },
  { id: 'ADL', name: 'Adelaide',     lat: -34.93, lon: 138.60, count: 9,  level: 'low' },
  { id: 'DRW', name: 'Darwin',       lat: -12.46, lon: 130.84, count: 7,  level: 'medium' },
  { id: 'CNS', name: 'Cairns',       lat: -16.92, lon: 145.77, count: 5,  level: 'low' },
  { id: 'TSV', name: 'Townsville',   lat: -19.26, lon: 146.81, count: 4,  level: 'low' },
  { id: 'PNG', name: 'Port Moresby', lat: -9.44,  lon: 147.18, count: 3,  level: 'medium' },
  { id: 'HON', name: 'Honiara',      lat: -9.43,  lon: 160.05, count: 2,  level: 'medium' },
  { id: 'ALX', name: 'Alice Spgs',   lat: -23.70, lon: 133.88, count: 2,  level: 'low' },
]

const INTEL_HUBS = [
  { name: 'Pine Gap (JDF)',      lat: -23.80, lon: 133.74, type: 'SIGINT' },
  { name: 'RAAF Tindal',        lat: -14.52, lon: 132.38, type: 'RAAF' },
  { name: 'RAAF Williamtown',   lat: -32.80, lon: 151.83, type: 'RAAF' },
  { name: 'RAAF Amberley',      lat: -27.64, lon: 152.71, type: 'RAAF' },
  { name: 'RAAF Pearce',        lat: -31.67, lon: 116.02, type: 'RAAF' },
  { name: 'HMAS Stirling',      lat: -32.24, lon: 115.68, type: 'RAN' },
  { name: 'HMAS Kuttabul',      lat: -33.86, lon: 151.22, type: 'RAN' },
  { name: 'JDFNWC Harold Holt', lat: -21.82, lon: 114.16, type: 'JOINT' },
  { name: 'JORN Alice Springs', lat: -23.66, lon: 133.88, type: 'RADAR' },
]

const HUB_COLOURS = {
  SIGINT: '#ff3d6b',
  RAAF:   '#00a8ff',
  RAN:    '#00ffcc',
  ARMY:   '#4caf50',
  JOINT:  '#f5c842',
  RADAR:  '#a078ff',
}

const CIVILIAN_AIRPORTS = [
  { name: 'Sydney (Kingsford Smith)', iata: 'SYD', lat: -33.94, lon: 151.18 },
  { name: 'Melbourne (Tullamarine)',  iata: 'MEL', lat: -37.67, lon: 144.84 },
  { name: 'Brisbane',                 iata: 'BNE', lat: -27.38, lon: 153.12 },
  { name: 'Perth',                    iata: 'PER', lat: -31.94, lon: 115.97 },
  { name: 'Adelaide',                 iata: 'ADL', lat: -34.95, lon: 138.53 },
  { name: 'Darwin',                   iata: 'DRW', lat: -12.41, lon: 130.88 },
  { name: 'Canberra',                 iata: 'CBR', lat: -35.31, lon: 149.19 },
  { name: 'Hobart',                   iata: 'HBA', lat: -42.84, lon: 147.51 },
  { name: 'Cairns',                   iata: 'CNS', lat: -16.89, lon: 145.76 },
  { name: 'Gold Coast',               iata: 'OOL', lat: -28.16, lon: 153.51 },
  { name: 'Townsville',               iata: 'TSV', lat: -19.25, lon: 146.77 },
  { name: 'Alice Springs',            iata: 'ASP', lat: -23.81, lon: 133.90 },
]

const MAJOR_SEAPORTS = [
  { name: 'Port of Brisbane',     lat: -27.37, lon: 153.17, type: 'CONTAINER' },
  { name: 'Port Botany (Sydney)', lat: -33.97, lon: 151.20, type: 'CONTAINER' },
  { name: 'Port of Melbourne',    lat: -37.83, lon: 144.93, type: 'CONTAINER' },
  { name: 'Fremantle Port',       lat: -32.05, lon: 115.74, type: 'CONTAINER' },
  { name: 'Port Adelaide',        lat: -34.84, lon: 138.49, type: 'CONTAINER' },
  { name: 'Darwin Port',          lat: -12.47, lon: 130.85, type: 'BULK' },
  { name: 'Port of Newcastle',    lat: -32.91, lon: 151.80, type: 'COAL' },
  { name: 'Port Kembla',          lat: -34.48, lon: 150.91, type: 'STEEL' },
  { name: 'Port Hedland',         lat: -20.32, lon: 118.60, type: 'IRON_ORE' },
  { name: 'Gladstone Port',       lat: -23.86, lon: 151.25, type: 'LNG' },
  { name: 'Hay Point (Coal)',     lat: -21.28, lon: 149.30, type: 'COAL' },
]

const ADF_BASES = [
  { name: 'RAAF Base Tindal',               lat: -14.52, lon: 132.38, type: 'RAAF' },
  { name: 'RAAF Base Darwin',               lat: -12.42, lon: 130.87, type: 'RAAF' },
  { name: 'RAAF Base Williamtown',          lat: -32.80, lon: 151.83, type: 'RAAF' },
  { name: 'RAAF Base Amberley',             lat: -27.64, lon: 152.71, type: 'RAAF' },
  { name: 'RAAF Base Pearce',               lat: -31.67, lon: 116.02, type: 'RAAF' },
  { name: 'RAAF Base Edinburgh',            lat: -34.70, lon: 138.62, type: 'RAAF' },
  { name: 'RAAF Base Townsville',           lat: -19.25, lon: 146.77, type: 'RAAF' },
  { name: 'RAAF Base Scherger',             lat: -12.64, lon: 142.10, type: 'RAAF' },
  { name: 'HMAS Stirling',                  lat: -32.24, lon: 115.68, type: 'RAN' },
  { name: 'HMAS Coonawarra (Darwin)',       lat: -12.46, lon: 130.85, type: 'RAN' },
  { name: 'HMAS Kuttabul (Sydney)',         lat: -33.86, lon: 151.22, type: 'RAN' },
  { name: 'HMAS Albatross (Nowra)',         lat: -34.95, lon: 150.53, type: 'RAN' },
  { name: 'Holsworthy Barracks',            lat: -33.96, lon: 150.95, type: 'ARMY' },
  { name: 'Lavarack Barracks (Townsville)', lat: -19.30, lon: 146.74, type: 'ARMY' },
  { name: 'Robertson Barracks (Darwin)',    lat: -12.38, lon: 130.97, type: 'ARMY' },
  { name: 'Gallipoli Barracks (Brisbane)',  lat: -27.56, lon: 152.94, type: 'ARMY' },
  { name: 'JDFNWC Harold Holt',            lat: -21.82, lon: 114.16, type: 'JOINT' },
  { name: 'Pine Gap (JDF)',                lat: -23.80, lon: 133.74, type: 'SIGINT' },
  { name: 'JORN Alice Springs',            lat: -23.66, lon: 133.88, type: 'RADAR' },
]

const NATIONAL_INFRA = [
  { name: 'Snowy Hydro (Tumut 3)',     lat: -35.93, lon: 148.28, type: 'HYDRO' },
  { name: 'Loy Yang A Power Station',  lat: -38.27, lon: 146.67, type: 'COAL' },
  { name: 'Lucas Heights (ANSTO)',     lat: -34.05, lon: 150.98, type: 'NUCLEAR' },
  { name: 'Olympic Dam (BHP)',         lat: -30.44, lon: 136.88, type: 'MINING' },
  { name: 'Pilbara Iron Ore Hub',      lat: -23.37, lon: 119.73, type: 'MINING' },
  { name: 'North West Shelf LNG',      lat: -20.63, lon: 116.77, type: 'LNG' },
  { name: 'Ichthys LNG (Darwin)',      lat: -12.44, lon: 130.83, type: 'LNG' },
  { name: 'Curtis Island LNG',         lat: -23.87, lon: 151.23, type: 'LNG' },
  { name: 'Basslink (TAS Connector)',  lat: -41.12, lon: 146.36, type: 'GRID' },
  { name: 'Eraring Power Station',     lat: -33.07, lon: 151.55, type: 'COAL' },
  { name: 'Hornsdale Wind Farm (SA)',  lat: -33.08, lon: 138.49, type: 'WIND' },
  { name: 'Kogan Creek Power Stn',    lat: -26.72, lon: 150.52, type: 'COAL' },
]

const INFRA_ICON = { HYDRO: '💧', COAL: '🏭', NUCLEAR: '☢', MINING: '⛏', LNG: '🛢', GRID: '⚡', WIND: '🌀' }

const RAIL_ROUTES = [
  { name: 'East Coast Main Line', color: '#4caf50',
    points: [[-27.47, 153.02], [-33.87, 151.21], [-37.81, 144.97]] },
  { name: 'The Ghan',            color: '#ff8f00',
    points: [[-34.93, 138.60], [-23.70, 133.88], [-12.46, 130.84]] },
  { name: 'Indian Pacific',      color: '#9c27b0',
    points: [[-31.95, 115.86], [-30.75, 121.47], [-31.51, 133.03], [-34.93, 138.60], [-33.87, 151.21]] },
  { name: 'Adelaide–Broken Hill', color: '#00bcd4',
    points: [[-34.93, 138.60], [-31.97, 141.46], [-33.87, 151.21]] },
]

const FINANCE_HUBS = [
  { name: 'ASX + RBA + CBA HQ',      lat: -33.865, lon: 151.210, type: 'EXCHANGE' },
  { name: 'Westpac Group HQ',         lat: -33.870, lon: 151.206, type: 'BANK' },
  { name: 'ANZ + NAB HQ (Melbourne)', lat: -37.815, lon: 144.966, type: 'BANK' },
  { name: 'BHP + Rio Tinto Perth',    lat: -31.953, lon: 115.862, type: 'MINING' },
  { name: 'Santos Energy (Adelaide)', lat: -34.930, lon: 138.601, type: 'ENERGY' },
  { name: 'Macquarie Group (Sydney)', lat: -33.868, lon: 151.204, type: 'FINANCE' },
]

const TABS = [
  { id: 'news',      label: '📰 NEWS & AI BRIEF' },
  { id: 'transport', label: '✈ TRANSPORT & MARITIME' },
  { id: 'warning',   label: '⚡ EARLY WARNING & POLICY' },
]

const LAYER_DEFAULTS = {
  liveFlights:      true,
  trains:           false,
  shipping:         true,
  seismic:          false,
  cameras:          false,
  airports:         false,
  seaports:         false,
  infrastructure:   false,
  submarineCables:  false,
  fires:            true,
  floods:           true,
  roadClosures:     false,
  emergencyAlerts:  true,
}

/* ── MapLibre style: CartoDB Dark raster, no API key required ── */
const MAP_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 512,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [{ id: 'carto-dark', type: 'raster', source: 'carto' }],
}

/* ── GeoJSON converters (MapLibre coords are [lng, lat]) ── */
const EMPTY_FC = Object.freeze({ type: 'FeatureCollection', features: [] })

const toFC = features => ({ type: 'FeatureCollection', features })

const flightsFC = flights => toFC((flights || []).map(f => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
  properties: { callsign: f.callsign || f.icao24 || '?', heading: f.heading ?? 0, altitude: f.altitude ?? 0, velocity: f.velocity ?? 0 },
})))

const shipsFC = ships => toFC((ships || []).map(s => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
  properties: { name: s.name || 'Unknown', mmsi: s.mmsi, speed: s.speed ?? 0 },
})))

const seismicFC = events => toFC((events || []).map(e => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
  properties: { magnitude: e.magnitude ?? 0, place: e.place || '', depth: e.depth ?? 0 },
})))

const firesFC = fires => toFC((fires || []).map(f => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
  properties: { brightness: f.brightness ?? 300, confidence: f.confidence || '' },
})))

const floodsFC = floods => toFC((floods || []).map(f => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
  properties: { title: f.title || '', type: f.type || '', severity: f.severity || 'minor', state: f.state || '' },
})))

const roadClosuresFC = hazards => toFC((hazards || []).map(h => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
  properties: {
    title: h.title || '', category: h.category || '', road: h.road || '',
    suburb: h.suburb || '', advice: h.advice || '', closure: h.closure ? 1 : 0,
  },
})))

const emergencyAlertsFC = alerts => toFC((alerts || []).map(a => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
  properties: {
    title: a.title || '', state: a.state || '', agency: a.agency || '',
    category: a.category || 'other', status: a.status || '', severity: a.severity ?? 0,
  },
})))

const railsFC = () => toFC(RAIL_ROUTES.map(r => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: r.points.map(([lat, lon]) => [lon, lat]) },
  properties: { name: r.name, color: r.color },
})))

/* ── HTML marker helpers ── */
function spawnMarkers(map, items, toLngLat, toInnerHtml, toPopupHtml) {
  return items.map(item => {
    const el = document.createElement('div')
    el.innerHTML = toInnerHtml(item)
    const popup = new maplibregl.Popup({ offset: 12, maxWidth: '220px', className: 'au-popup' })
      .setHTML(toPopupHtml(item))
    return new maplibregl.Marker({ element: el })
      .setLngLat(toLngLat(item))
      .setPopup(popup)
      .addTo(map)
  })
}

function setMarkersVisible(markers, visible) {
  markers.forEach(m => { m.getElement().style.display = visible ? '' : 'none' })
  return markers
}

const createNewsClusters = map => spawnMarkers(
  map, NEWS_CLUSTERS,
  c => [c.lon, c.lat],
  c => {
    const size = c.count > 30 ? 32 : c.count > 10 ? 26 : 20
    return `<div class="news-cluster-marker ${c.level}" style="width:${size}px;height:${size}px;font-size:${size < 26 ? 9 : 11}px">${c.count}</div>`
  },
  c => `<b>${c.name}</b><br/>${c.count} signals`,
)

const createIntelHubs = map => spawnMarkers(
  map, INTEL_HUBS,
  h => [h.lon, h.lat],
  h => {
    const col = HUB_COLOURS[h.type] || '#888'
    return `<div style="width:10px;height:10px;border-radius:50%;background:${col};border:1.5px solid rgba(255,255,255,0.4);box-shadow:0 0 8px ${col}"></div>`
  },
  h => `<b>${h.name}</b> [${h.type}]`,
)

const createAirportMarkers = map => spawnMarkers(
  map, CIVILIAN_AIRPORTS,
  a => [a.lon, a.lat],
  () => `<div style="color:#00a8ff;font-size:14px;filter:drop-shadow(0 0 5px #00a8ff)">✈</div>`,
  a => `<b>${a.iata}</b> — ${a.name}`,
)

const createSeaportMarkers = map => spawnMarkers(
  map, MAJOR_SEAPORTS,
  s => [s.lon, s.lat],
  () => `<div style="color:#00ffcc;font-size:14px;filter:drop-shadow(0 0 5px #00ffcc)">⚓</div>`,
  s => `<b>${s.name}</b> [${s.type}]`,
)

const createMilitaryMarkers = map => spawnMarkers(
  map, ADF_BASES,
  b => [b.lon, b.lat],
  b => {
    const col = HUB_COLOURS[b.type] || '#888'
    return `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid ${col};filter:drop-shadow(0 0 4px ${col})"></div>`
  },
  b => `<b>${b.name}</b> [${b.type}]`,
)

const createInfraMarkers = map => spawnMarkers(
  map, NATIONAL_INFRA,
  i => [i.lon, i.lat],
  i => `<div style="font-size:14px;filter:drop-shadow(0 0 5px rgba(255,200,0,0.9))">${INFRA_ICON[i.type] || '⚡'}</div>`,
  i => `<b>${i.name}</b> [${i.type}]`,
)

const createFinanceMarkers = map => {
  const ICON = { EXCHANGE: '📈', BANK: '🏦', MINING: '⛏', ENERGY: '🛢', FINANCE: '💹' }
  return spawnMarkers(
    map, FINANCE_HUBS,
    f => [f.lon, f.lat],
    f => `<div style="font-size:13px;filter:drop-shadow(0 0 4px rgba(100,255,100,0.8))">${ICON[f.type] || '💹'}</div>`,
    f => `<b>${f.name}</b>`,
  )
}

/* ── GL layer click popup helper ── */
function addClickPopup(map, layerId, getHtml) {
  map.on('click', layerId, e => {
    if (!e.features.length) return
    new maplibregl.Popup({ maxWidth: '240px', className: 'au-popup' })
      .setLngLat(e.lngLat)
      .setHTML(getHtml(e.features[0].properties))
      .addTo(map)
  })
  map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
}

/* ── Custom map icons (white SDF shapes — tinted at runtime via icon-color) ── */
const FLIGHT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="white" d="M12 2 L10 8 L3 11 L3 13 L10 11.5 L10 16 L7.5 17.5 L7.5 19 L12 17.5 L16.5 19 L16.5 17.5 L14 16 L14 11.5 L21 13 L21 11 L14 8 Z"/>
</svg>`

const SHIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="white" d="M12 2 Q15 4 16 8 L16 17 Q16 21 12 22 Q8 21 8 17 L8 8 Q9 4 12 2 Z"/>
  <rect x="10" y="9" width="4" height="4" rx="0.5" fill="white" opacity="0.6"/>
</svg>`


function loadSvgImage(svgStr, size = 24) {
  return new Promise((resolve, reject) => {
    const img = new Image(size, size)
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)
  })
}

/* ── Which toggle keys map to GL layer ids ── */
const GL_LAYERS = {
  liveFlights:     ['flights-layer'],
  shipping:        ['ships-layer'],
  seismic:         ['seismic-layer'],
  fires:           ['fires-layer'],
  floods:          ['floods-layer'],
  trains:          ['trains-layer'],
  submarineCables: ['cables-layer', 'cable-landings-layer'],
  roadClosures:    ['road-closures-layer'],
  emergencyAlerts: ['emergency-alerts-layer'],
}

/* ── Component ── */
export default function MapCenter({ newsItems, flights, ships, seismic, fires, floods, fids, aiBrief, threatIndex, roadClosures, emergencyAlerts, emergencyImpact, warningFocusSignal, isActive }) {
  const mapRef     = useRef(null)
  const markersRef = useRef({})
  const dataRef    = useRef({ flights: [], ships: [], seismic: [], fires: [], floods: [], roadClosures: [], emergencyAlerts: [] })
  const cablesRef  = useRef(null)

  const [activeTab, setActiveTab] = useState('news')
  const [layers, setLayers]       = useState(LAYER_DEFAULTS)

  useEffect(() => {
    if (warningFocusSignal) setActiveTab('warning')
  }, [warningFocusSignal])

  /* On mobile the map is display:none while another panel is active — MapLibre
     needs a resize() nudge when it becomes visible again so the canvas isn't stale. */
  useEffect(() => {
    if (isActive) mapRef.current?.resize()
  }, [isActive])

  /* ── Init map once ── */
  useEffect(() => {
    if (mapRef.current) return

    const map = new maplibregl.Map({
      container: 'au-map',
      style:     MAP_STYLE,
      center:    [134, -27],
      zoom:      4,
      attributionControl: true,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-left')

    map.on('load', async () => {
      /* ── Register custom icons (SDF = runtime tint via icon-color) ── */
      try {
        const [flightImg, shipImg] = await Promise.all([
          loadSvgImage(FLIGHT_SVG, 24),
          loadSvgImage(SHIP_SVG, 24),
        ])
        map.addImage('flight-icon', flightImg, { sdf: true })
        map.addImage('ship-icon',   shipImg,   { sdf: true })
      } catch (err) {
        console.warn('[MAP] SVG icon load failed:', err)
      }

      /* ── GeoJSON sources ── */
      ;[
        ['flights',        flightsFC(dataRef.current.flights)],
        ['ships',          shipsFC(dataRef.current.ships)],
        ['seismic',        seismicFC(dataRef.current.seismic)],
        ['fires',          firesFC(dataRef.current.fires)],
        ['floods',         floodsFC(dataRef.current.floods)],
        ['road-closures',  roadClosuresFC(dataRef.current.roadClosures)],
        ['emergency-alerts', emergencyAlertsFC(dataRef.current.emergencyAlerts)],
        ['rails',          railsFC()],
        ['cables',         cablesRef.current?.cables   ?? EMPTY_FC],
        ['cable-landings', cablesRef.current?.landings ?? EMPTY_FC],
      ].forEach(([id, data]) => map.addSource(id, { type: 'geojson', data }))

      /* ── GL layers ── */
      const vis = key => LAYER_DEFAULTS[key] ? 'visible' : 'none'

      map.addLayer({
        id: 'flights-layer', type: 'symbol', source: 'flights',
        layout: {
          visibility:                vis('liveFlights'),
          'icon-image':              'flight-icon',
          'icon-size':               0.7,
          'icon-rotate':             ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap':      true,
          'icon-ignore-placement':   true,
        },
        paint: {
          'icon-color':   '#00ffcc',
          'icon-opacity': 0.95,
          'icon-halo-color': 'rgba(0,255,204,0.25)',
          'icon-halo-width': 2,
        },
      })
      addClickPopup(map, 'flights-layer',
        p => `<b>${p.callsign}</b><br/>Alt: ${Math.round(p.altitude)}m · ${Math.round(p.velocity)} m/s`)

      map.addLayer({
        id: 'ships-layer', type: 'symbol', source: 'ships',
        layout: {
          visibility:                vis('shipping'),
          'icon-image':              'ship-icon',
          'icon-size':               0.65,
          'icon-rotate':             ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap':      true,
          'icon-ignore-placement':   true,
        },
        paint: {
          'icon-color':   ['case', ['>', ['get', 'speed'], 10], '#f5c842', '#00bfff'],
          'icon-opacity': 0.95,
          'icon-halo-color': 'rgba(0,191,255,0.2)',
          'icon-halo-width': 2,
        },
      })
      addClickPopup(map, 'ships-layer',
        p => `<b>${p.name}</b><br/>MMSI: ${p.mmsi} · ${Number(p.speed).toFixed(1)} kn`)

      map.addLayer({
        id: 'seismic-layer', type: 'circle', source: 'seismic',
        layout: { visibility: vis('seismic') },
        paint: {
          'circle-radius':  ['interpolate', ['linear'], ['get', 'magnitude'], 1, 5, 5, 18, 8, 36],
          'circle-color':   'rgba(255,100,30,0.55)',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ff6b1e',
          'circle-opacity': ['interpolate', ['linear'], ['get', 'magnitude'], 1, 0.3, 8, 0.85],
        },
      })
      addClickPopup(map, 'seismic-layer',
        p => `<b>M${Number(p.magnitude).toFixed(1)}</b><br/>${p.place}<br/>Depth: ${p.depth}km`)

      map.addLayer({
        id: 'fires-layer', type: 'circle', source: 'fires',
        layout: { visibility: vis('fires') },
        paint: {
          'circle-radius':       ['case', ['>', ['get', 'brightness'], 350], 7, 5],
          'circle-color':        ['case', ['>', ['get', 'brightness'], 380], '#ff2200', ['>', ['get', 'brightness'], 340], '#ff6600', '#ffaa00'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ff8800',
          'circle-opacity':      0.85,
        },
      })
      addClickPopup(map, 'fires-layer',
        p => `🔥 Hotspot<br/>Brightness: ${p.brightness}<br/>Confidence: ${p.confidence}`)

      map.addLayer({
        id: 'floods-layer', type: 'circle', source: 'floods',
        layout: { visibility: vis('floods') },
        paint: {
          'circle-radius':       8,
          'circle-color':        ['case', ['==', ['get', 'type'], 'flood_warning'], '#ff4488', '#00bfff'],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.4)',
          'circle-opacity':      0.85,
        },
      })
      addClickPopup(map, 'floods-layer',
        p => `🌊 <b>${p.title}</b><br/>Type: ${p.type.replace(/_/g, ' ')}<br/>State: ${p.state}`)

      map.addLayer({
        id: 'road-closures-layer', type: 'circle', source: 'road-closures',
        layout: { visibility: vis('roadClosures') },
        paint: {
          'circle-radius':       ['case', ['==', ['get', 'closure'], 1], 9, 6],
          'circle-color':        ['case', ['==', ['get', 'closure'], 1], '#ff3d6b', '#f5c842'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.4)',
          'circle-opacity':      0.85,
        },
      })
      addClickPopup(map, 'road-closures-layer',
        p => `🚧 <b>${p.title}</b><br/>${p.road ? `Road: ${p.road}<br/>` : ''}${p.suburb ? `Suburb: ${p.suburb}<br/>` : ''}${p.closure ? '<b style="color:#ff3d6b">CLOSED</b>' : p.category}${p.advice ? `<br/>${p.advice}` : ''}`)

      map.addLayer({
        id: 'emergency-alerts-layer', type: 'circle', source: 'emergency-alerts',
        layout: { visibility: vis('emergencyAlerts') },
        paint: {
          'circle-radius':       ['step', ['get', 'severity'], 5, 1, 6, 2, 8, 3, 10],
          'circle-color':        ['step', ['get', 'severity'], '#888888', 1, '#f5c842', 2, '#ff8c00', 3, '#ff3d6b'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.4)',
          'circle-opacity':      0.85,
        },
      })
      addClickPopup(map, 'emergency-alerts-layer',
        p => `🚨 <b>${p.title}</b><br/>${p.state} ${p.agency}${p.status ? ` — ${p.status}` : ''}<br/>Category: ${p.category}`)

      map.addLayer({
        id: 'trains-layer', type: 'line', source: 'rails',
        layout: { visibility: vis('trains'), 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color':     ['get', 'color'],
          'line-width':     2,
          'line-opacity':   0.75,
          'line-dasharray': [2, 2],
        },
      })

      map.addLayer({
        id: 'cables-layer', type: 'line', source: 'cables',
        layout: { visibility: vis('submarineCables'), 'line-join': 'round' },
        paint: { 'line-color': '#ff6b35', 'line-width': 1.5, 'line-opacity': 0.6 },
      })

      map.addLayer({
        id: 'cable-landings-layer', type: 'circle', source: 'cable-landings',
        layout: { visibility: vis('submarineCables') },
        paint: {
          'circle-radius': 3,
          'circle-color':  '#ff6b35',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
        },
      })
      addClickPopup(map, 'cable-landings-layer', p => `<b>${p.name ?? 'Landing Point'}</b>`)

      /* ── HTML markers for static overlays ── */
      markersRef.current = {
        newsClusters:  createNewsClusters(map),
        airports:      setMarkersVisible(createAirportMarkers(map),  LAYER_DEFAULTS.airports),
        seaports:      setMarkersVisible(createSeaportMarkers(map),  LAYER_DEFAULTS.seaports),
        infrastructure: setMarkersVisible(createInfraMarkers(map),   LAYER_DEFAULTS.infrastructure),
      }
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current     = null
      markersRef.current = {}
    }
  }, [])

  /* ── Fetch cables once, push to sources ── */
  useEffect(() => {
    fetch('/api/cables').then(r => r.json()).then(data => {
      cablesRef.current = data
      mapRef.current?.getSource('cables')?.setData(data.cables ?? EMPTY_FC)
      mapRef.current?.getSource('cable-landings')?.setData(data.landings ?? EMPTY_FC)
    }).catch(() => {})
  }, [])

  /* ── Live data → GeoJSON source updates ── */
  useEffect(() => {
    dataRef.current.flights = flights || []
    mapRef.current?.getSource('flights')?.setData(flightsFC(flights))
  }, [flights])

  useEffect(() => {
    dataRef.current.ships = ships || []
    mapRef.current?.getSource('ships')?.setData(shipsFC(ships))
  }, [ships])

  useEffect(() => {
    dataRef.current.seismic = seismic || []
    mapRef.current?.getSource('seismic')?.setData(seismicFC(seismic))
  }, [seismic])

  useEffect(() => {
    dataRef.current.fires = fires || []
    mapRef.current?.getSource('fires')?.setData(firesFC(fires))
  }, [fires])

  useEffect(() => {
    dataRef.current.floods = floods || []
    mapRef.current?.getSource('floods')?.setData(floodsFC(floods))
  }, [floods])

  useEffect(() => {
    dataRef.current.roadClosures = roadClosures || []
    mapRef.current?.getSource('road-closures')?.setData(roadClosuresFC(roadClosures))
  }, [roadClosures])

  useEffect(() => {
    dataRef.current.emergencyAlerts = emergencyAlerts || []
    mapRef.current?.getSource('emergency-alerts')?.setData(emergencyAlertsFC(emergencyAlerts))
  }, [emergencyAlerts])

  /* ── Layer toggle ── */
  const toggleLayer = key => {
    setLayers(prev => {
      const next    = { ...prev, [key]: !prev[key] }
      const visible = next[key]
      const map     = mapRef.current
      if (!map) return next

      GL_LAYERS[key]?.forEach(id => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
      })

      markersRef.current[key]?.forEach(m => {
        m.getElement().style.display = visible ? '' : 'none'
      })

      return next
    })
  }

  return (
    <div className="map-center">
      <div className="map-wrapper">
        <div id="au-map" />

        <div className="map-scanlines" />
        <div className="map-corner tl" />
        <div className="map-corner tr" />
        <div className="map-corner bl" />
        <div className="map-corner br" />

        <MapOverlayControls layers={layers} onToggle={toggleLayer} />
      </div>

      <div className="map-panel">
        <div className="map-panel-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`map-panel-tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="map-panel-content">
          {activeTab === 'news'      && <NewsPanel newsItems={newsItems} aiBrief={aiBrief} />}
          {activeTab === 'transport' && <TransportPanel flights={flights} ships={ships} fids={fids} />}
          {activeTab === 'warning'   && <WarningPanel threatIndex={threatIndex} emergencyImpact={emergencyImpact} />}
        </div>
      </div>
    </div>
  )
}

/* ── Transport tab ── */
function TransportPanel({ flights, ships, fids }) {
  const airports    = Object.values(fids || {})
  const isAirlabs   = airports[0]?.source === 'airlabs'
  const isOpenSky   = airports[0]?.source === 'opensky'
  const sourceLabel = isAirlabs ? 'AirLabs · scheduled' : isOpenSky ? 'OpenSky · TCA traffic' : null

  return (
    <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <span style={{ color: 'var(--accent-cyan)' }}>✈ {flights?.length ?? 0} aircraft</span>
        <span style={{ color: 'var(--accent-green)' }}>🚢 {Object.keys(ships || {}).length > 0 ? Object.keys(ships).length : (ships?.length ?? 0)} vessels</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color: 'var(--accent-cyan)' }}>AIRPORT TRAFFIC</span>
        {sourceLabel && (
          <span style={{ fontSize: 10, color: 'var(--accent-green)', border: '1px solid var(--accent-green)', padding: '1px 5px', borderRadius: 3 }}>
            LIVE · {sourceLabel}
          </span>
        )}
        {!airports.length && (
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>connecting…</span>
        )}
      </div>

      {airports.length > 0
        ? airports.sort((a, b) => b.departures - a.departures).map(a => (
            <div key={a.iata} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ width: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.iata} — {a.name}</span>
              <span>{isAirlabs ? 'DEP' : 'TCA'} <span style={{ color: 'var(--accent-blue)' }}>{a.departures}</span></span>
              {a.delayed != null
                ? <span>DLY <span style={{ color: a.delayed > 5 ? 'var(--accent-red)' : 'var(--accent-orange)' }}>{a.delayed}</span></span>
                : <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>DLY —</span>
              }
            </div>
          ))
        : (
            <div style={{ color: 'var(--text-dim)', fontSize: 11, paddingTop: 4 }}>
              Waiting for OpenSky data (up to 5 min on first start)
            </div>
          )
      }
    </div>
  )
}

/* ── Early Warning tab ── */
const THREAT_CATEGORY_META = {
  seismic:        { icon: '📡', label: 'SEISMIC' },
  weather:        { icon: '⛈',  label: 'SEVERE WEATHER' },
  fire:           { icon: '🔥', label: 'FIRE' },
  flood:          { icon: '🌊', label: 'FLOOD' },
  cyber:          { icon: '🛡',  label: 'CYBER ADVISORY' },
  infrastructure: { icon: '🚧', label: 'INFRASTRUCTURE' },
  energy:         { icon: '⚡', label: 'ENERGY SUPPLY' },
}

function formatSourceTime(time) {
  if (!time) return ''
  const d = new Date(time)
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-AU', { hour12: false, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function WarningPanel({ threatIndex, emergencyImpact }) {
  const [expanded, setExpanded] = useState(null)

  if (!threatIndex) {
    return (
      <div style={{ padding: '12px 16px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        Computing threat level index…
      </div>
    )
  }

  const { overall, categories } = threatIndex

  return (
    <div style={{ overflowY: 'auto', padding: '8px 10px', flex: 1 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', marginBottom: 8, borderRadius: 4,
        background: `${overall.color}14`, border: `1px solid ${overall.color}66`,
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>THREAT LEVEL INDEX</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: overall.color, fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
            {overall.name} — {overall.label.toUpperCase()}
          </div>
        </div>
        {overall.driver && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
            DRIVEN BY<br /><span style={{ color: overall.color }}>{THREAT_CATEGORY_META[overall.driver]?.label ?? overall.driver}</span>
          </div>
        )}
      </div>

      {Object.entries(categories).map(([key, cat]) => {
        const meta      = THREAT_CATEGORY_META[key] ?? { icon: '•', label: key.toUpperCase() }
        const color     = ['#00e676', '#00a8ff', '#f5c842', '#ff8c00', '#ff3d6b'][cat.level] ?? '#4a6080'
        const isOpen    = expanded === key
        const aggregate = key === 'emergencyAlerts' ? emergencyImpact?.aggregate : null
        const narrativeById = key === 'emergencyAlerts'
          ? Object.fromEntries((emergencyImpact?.perIncident ?? []).map(p => [p.id, p]))
          : {}

        return (
          <div key={key} style={{ marginBottom: 4, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4 }}>
            <div
              onClick={() => setExpanded(isOpen ? null : key)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: cat.sources.length ? 'pointer' : 'default' }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>{meta.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{meta.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {cat.summary}
                  {aggregate && ` · ~${aggregate.totalPeopleEstimate.toLocaleString('en-AU')} people in affected areas (approx.)`}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: 3,
                color, border: `1px solid ${color}`, flexShrink: 0,
              }}>
                {['GREEN', 'BLUE', 'YELLOW', 'ORANGE', 'RED'][cat.level]}
              </span>
              {cat.sources.length > 0 && (
                <span style={{ color: 'var(--text-dim)', fontSize: 11, flexShrink: 0 }}>{isOpen ? '▾' : '▸'}</span>
              )}
            </div>

            {isOpen && cat.sources.length > 0 && (
              <div style={{ padding: '2px 8px 6px 30px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                {cat.sources.map((s, i) => {
                  const narrative = narrativeById[s.id]?.narrative
                  return (
                    <div key={i}>
                      {s.url
                        ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', padding: '3px 0', textDecoration: 'none' }}>
                            — {s.label} {formatSourceTime(s.time) && <span style={{ color: 'var(--text-dim)' }}>({formatSourceTime(s.time)})</span>}
                          </a>
                        : <div style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '3px 0' }}>
                            — {s.label} {formatSourceTime(s.time) && <span style={{ color: 'var(--text-dim)' }}>({formatSourceTime(s.time)})</span>}
                          </div>
                      }
                      {narrative && (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '0 0 4px 14px', fontStyle: 'italic' }}>
                          <span style={{ color: 'var(--accent-cyan)', fontStyle: 'normal' }}>[AI estimate]</span> {narrative}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 6, textAlign: 'right' }}>
        Updated {formatSourceTime(threatIndex.computedAt)}
      </div>
    </div>
  )
}
