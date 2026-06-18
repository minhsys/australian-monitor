import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
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

const INFRA_ICON = { HYDRO:'💧', COAL:'🏭', NUCLEAR:'☢', MINING:'⛏', LNG:'🛢', GRID:'⚡', WIND:'🌀' }

const RAIL_ROUTES = [
  { name: 'East Coast Main Line', color: '#4caf50',
    points: [[-27.47,153.02],[-33.87,151.21],[-37.81,144.97]] },
  { name: 'The Ghan',            color: '#ff8f00',
    points: [[-34.93,138.60],[-23.70,133.88],[-12.46,130.84]] },
  { name: 'Indian Pacific',      color: '#9c27b0',
    points: [[-31.95,115.86],[-30.75,121.47],[-31.51,133.03],[-34.93,138.60],[-33.87,151.21]] },
  { name: 'Adelaide–Broken Hill', color: '#00bcd4',
    points: [[-34.93,138.60],[-31.97,141.46],[-33.87,151.21]] },
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
  intelligenceHubs: true,
  liveFlights:      true,
  trains:           false,
  shipping:         true,
  seismic:          false,
  cameras:          false,
  airports:         false,
  seaports:         false,
  infrastructure:   false,
  militaryBases:    false,
  financeLayer:     false,
  submarineCables:  false,
  fires:            true,
}

/* ── Icon builders ── */
function flightIcon(heading) {
  return L.divIcon({
    className: '',
    html: `<div class="flight-marker" style="transform:rotate(${heading}deg)">✈</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function shipIcon(speed) {
  const col = speed > 10 ? '#f5c842' : '#00ffcc'
  return L.divIcon({
    className: '',
    html: `<div class="ship-marker" style="background:${col};border-color:${col}"></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  })
}

function seismicIcon(magnitude) {
  const size = Math.max(10, Math.min(36, magnitude * 8))
  const opacity = Math.min(0.7, 0.2 + magnitude * 0.1)
  return L.divIcon({
    className: '',
    html: `<div class="seismic-marker" style="width:${size}px;height:${size}px;opacity:${opacity}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function fireIcon(brightness) {
  const size = brightness > 350 ? 14 : 10
  return L.divIcon({
    className: '',
    html: `<div class="fire-marker" style="font-size:${size}px">🔥</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

/* ── Layer drawing helpers ── */
function drawNewsClusters(group) {
  NEWS_CLUSTERS.forEach(city => {
    const size = city.count > 30 ? 32 : city.count > 10 ? 26 : 20
    const icon = L.divIcon({
      className: '',
      html: `<div class="news-cluster-marker ${city.level}"
                  style="width:${size}px;height:${size}px;font-size:${size < 26 ? 9 : 11}px">
                ${city.count}
             </div>`,
      iconSize:   [size, size],
      iconAnchor: [size / 2, size / 2],
    })
    L.marker([city.lat, city.lon], { icon })
      .bindTooltip(`<b>${city.name}</b><br/>${city.count} signals`, {
        className: '', direction: 'top', offset: [0, -size / 2],
      })
      .addTo(group)
  })
}

function drawIntelHubs(group) {
  INTEL_HUBS.forEach(hub => {
    const col = HUB_COLOURS[hub.type] || '#888'
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:10px;height:10px;border-radius:50%;
        background:${col};border:1.5px solid rgba(255,255,255,0.4);
        box-shadow:0 0 8px ${col}">
      </div>`,
      iconSize:   [10, 10],
      iconAnchor: [5, 5],
    })
    L.marker([hub.lat, hub.lon], { icon })
      .bindTooltip(`<b>${hub.name}</b> [${hub.type}]`, { direction: 'top', offset: [0, -8] })
      .addTo(group)
  })
}

function redrawFlights(group, flights) {
  group.clearLayers()
  flights.forEach(f => {
    L.marker([f.lat, f.lon], { icon: flightIcon(f.heading) })
      .bindTooltip(
        `<b>${f.callsign || f.icao24}</b><br/>Alt: ${Math.round(f.altitude ?? 0)}m · ${Math.round(f.velocity ?? 0)} m/s`,
        { direction: 'top', offset: [0, -10] }
      )
      .addTo(group)
  })
}

function redrawShips(group, ships) {
  group.clearLayers()
  ships.forEach(s => {
    L.marker([s.lat, s.lon], { icon: shipIcon(s.speed) })
      .bindTooltip(
        `<b>${s.name}</b><br/>MMSI: ${s.mmsi} · ${s.speed?.toFixed(1)} kn`,
        { direction: 'top', offset: [0, -8] }
      )
      .addTo(group)
  })
}

function redrawSeismic(group, events) {
  group.clearLayers()
  events.forEach(e => {
    L.marker([e.lat, e.lon], { icon: seismicIcon(e.magnitude) })
      .bindTooltip(
        `<b>M${e.magnitude?.toFixed(1)}</b><br/>${e.place}<br/>Depth: ${e.depth}km`,
        { direction: 'top', offset: [0, -8] }
      )
      .addTo(group)
  })
}

function redrawFires(group, fires) {
  group.clearLayers()
  fires.forEach(f => {
    L.marker([f.lat, f.lon], { icon: fireIcon(f.brightness) })
      .bindTooltip(
        `🔥 Hotspot<br/>Brightness: ${f.brightness}<br/>Confidence: ${f.confidence}`,
        { direction: 'top', offset: [0, -8] }
      )
      .addTo(group)
  })
}

function drawAirports(group) {
  CIVILIAN_AIRPORTS.forEach(ap => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="color:#00a8ff;font-size:14px;filter:drop-shadow(0 0 5px #00a8ff)">✈</div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    })
    L.marker([ap.lat, ap.lon], { icon })
      .bindTooltip(`<b>${ap.iata}</b> — ${ap.name}`, { direction: 'top', offset: [0, -8] })
      .addTo(group)
  })
}

function drawSeaports(group) {
  MAJOR_SEAPORTS.forEach(sp => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="color:#00ffcc;font-size:14px;filter:drop-shadow(0 0 5px #00ffcc)">⚓</div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    })
    L.marker([sp.lat, sp.lon], { icon })
      .bindTooltip(`<b>${sp.name}</b> [${sp.type}]`, { direction: 'top', offset: [0, -8] })
      .addTo(group)
  })
}

function drawMilitaryBases(group) {
  ADF_BASES.forEach(base => {
    const col = HUB_COLOURS[base.type] || '#888'
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid ${col};filter:drop-shadow(0 0 4px ${col})"></div>`,
      iconSize: [12, 10], iconAnchor: [6, 10],
    })
    L.marker([base.lat, base.lon], { icon })
      .bindTooltip(`<b>${base.name}</b> [${base.type}]`, { direction: 'top', offset: [0, -10] })
      .addTo(group)
  })
}

function drawInfrastructure(group) {
  NATIONAL_INFRA.forEach(item => {
    const emoji = INFRA_ICON[item.type] || '⚡'
    const icon = L.divIcon({
      className: '',
      html: `<div style="font-size:14px;filter:drop-shadow(0 0 5px rgba(255,200,0,0.9))">${emoji}</div>`,
      iconSize: [16, 16], iconAnchor: [8, 8],
    })
    L.marker([item.lat, item.lon], { icon })
      .bindTooltip(`<b>${item.name}</b> [${item.type}]`, { direction: 'top', offset: [0, -8] })
      .addTo(group)
  })
}

function drawRailRoutes(group) {
  RAIL_ROUTES.forEach(route => {
    L.polyline(route.points, {
      color: route.color, weight: 2, opacity: 0.7, dashArray: '4 4',
    })
      .bindTooltip(`<b>${route.name}</b>`, { direction: 'center', sticky: true })
      .addTo(group)
  })
}

function drawFinanceHubs(group) {
  const typeIcon = { EXCHANGE: '📈', BANK: '🏦', MINING: '⛏', ENERGY: '🛢', FINANCE: '💹' }
  FINANCE_HUBS.forEach(hub => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="font-size:13px;filter:drop-shadow(0 0 4px rgba(100,255,100,0.8))">${typeIcon[hub.type] || '💹'}</div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    })
    L.marker([hub.lat, hub.lon], { icon })
      .bindTooltip(`<b>${hub.name}</b>`, { direction: 'top', offset: [0, -8] })
      .addTo(group)
  })
}

function drawCables(group, cablesData) {
  if (!cablesData?.cables?.features) return
  cablesData.cables.features.forEach(f => {
    try {
      const coords = f.geometry?.type === 'MultiLineString'
        ? f.geometry.coordinates.flat(1)
        : f.geometry?.coordinates ?? []
      if (coords.length < 2) return
      const latlngs = coords.map(([lon, lat]) => [lat, lon])
      L.polyline(latlngs, { color: '#ff6b35', weight: 1.5, opacity: 0.6 })
        .bindTooltip(`<b>${f.properties?.name ?? 'Submarine Cable'}</b>`, { sticky: true })
        .addTo(group)
    } catch { /* skip malformed feature */ }
  })
  cablesData.landings?.features?.forEach(f => {
    try {
      const [lon, lat] = f.geometry.coordinates
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:6px;height:6px;background:#ff6b35;border-radius:50%;border:1px solid #fff;box-shadow:0 0 5px #ff6b35"></div>`,
        iconSize: [6, 6], iconAnchor: [3, 3],
      })
      L.marker([lat, lon], { icon })
        .bindTooltip(f.properties?.name ?? 'Landing Point', { direction: 'top', offset: [0, -5] })
        .addTo(group)
    } catch { /* skip */ }
  })
}

/* ── Component ── */
export default function MapCenter({ newsItems, flights, ships, seismic, fires, fids, aiBrief }) {
  const mapRef    = useRef(null)
  const groupsRef = useRef({})
  const [activeTab, setActiveTab] = useState('news')
  const [layers, setLayers]       = useState(LAYER_DEFAULTS)
  const [cablesData, setCablesData] = useState(null)

  /* ── Init map once ── */
  useEffect(() => {
    if (mapRef.current) return

    const map = L.map('au-map', {
      center: [-27, 134],
      zoom: 4,
      zoomControl: false,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    L.control.zoom({ position: 'topleft' }).addTo(map)

    const on  = g => L.layerGroup().addTo(map)
    const off = () => L.layerGroup()

    const groups = {
      newsClusters:     on(),
      intelligenceHubs: on(),
      liveFlights:      on(),
      shipping:         on(),
      fires:            on(),
      seismic:          off(),   // default off
      airports:         off(),   // default off
      seaports:         off(),   // default off
      militaryBases:    off(),   // default off
      infrastructure:   off(),   // default off
      trains:           off(),   // default off
      financeLayer:     off(),   // default off
      submarineCables:  off(),   // default off
    }

    groupsRef.current = groups
    mapRef.current    = map

    drawNewsClusters(groups.newsClusters)
    drawIntelHubs(groups.intelligenceHubs)
    drawAirports(groups.airports)
    drawSeaports(groups.seaports)
    drawMilitaryBases(groups.militaryBases)
    drawInfrastructure(groups.infrastructure)
    drawRailRoutes(groups.trains)
    drawFinanceHubs(groups.financeLayer)

    return () => {
      map.remove()
      mapRef.current    = null
      groupsRef.current = {}
    }
  }, [])

  /* ── Live layer updates ── */
  useEffect(() => {
    const g = groupsRef.current.liveFlights
    if (!g) return
    redrawFlights(g, layers.liveFlights ? (flights || []) : [])
  }, [flights, layers.liveFlights])

  useEffect(() => {
    const g = groupsRef.current.shipping
    if (!g) return
    redrawShips(g, layers.shipping ? (ships || []) : [])
  }, [ships, layers.shipping])

  useEffect(() => {
    const g = groupsRef.current.seismic
    if (!g) return
    redrawSeismic(g, layers.seismic ? (seismic || []) : [])
  }, [seismic, layers.seismic])

  useEffect(() => {
    const g = groupsRef.current.fires
    if (!g) return
    redrawFires(g, layers.fires ? (fires || []) : [])
  }, [fires, layers.fires])

  /* ── Fetch cables once on mount ── */
  useEffect(() => {
    fetch('/api/cables').then(r => r.json()).then(setCablesData).catch(() => {})
  }, [])

  /* ── Draw cables when data arrives or layer toggled ── */
  useEffect(() => {
    const g = groupsRef.current.submarineCables
    if (!g) return
    g.clearLayers()
    if (layers.submarineCables && cablesData) drawCables(g, cablesData)
  }, [cablesData, layers.submarineCables])

  /* ── Toggle overlay visibility ── */
  const toggleLayer = (key) => {
    setLayers(prev => {
      const next  = { ...prev, [key]: !prev[key] }
      const map   = mapRef.current
      const group = groupsRef.current[key]
      if (map && group) {
        if (next[key]) map.addLayer(group)
        else           map.removeLayer(group)
      }
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
          {activeTab === 'warning'   && <WarningPanel seismic={seismic} />}
        </div>
      </div>
    </div>
  )
}

/* ── Transport tab ── */
function TransportPanel({ flights, ships, fids }) {
  const airports   = Object.values(fids || {})
  const isAirlabs  = airports[0]?.source === 'airlabs'
  const isOpenSky  = airports[0]?.source === 'opensky'
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
function WarningPanel({ seismic }) {
  const recentQuakes = (seismic || []).slice(0, 5)

  return (
    <div style={{ overflowY: 'auto', padding: '6px 10px', flex: 1 }}>
      {recentQuakes.length > 0 && (
        <div style={{ marginBottom: 6, color: 'var(--accent-orange)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          RECENT SEISMIC ACTIVITY
        </div>
      )}
      {recentQuakes.map((e, i) => (
        <div key={e.id ?? i} style={{ display: 'flex', gap: 8, padding: '4px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>📡</span>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>M{e.magnitude?.toFixed(1)} — {e.place}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>Depth: {e.depth}km</div>
          </div>
        </div>
      ))}
      {[
        { icon: '🟠', title: 'ACSC Alert — Ransomware campaign targeting AU finance sector', area: 'National', time: '18m ago' },
        { icon: '🟠', title: 'DFAT — Travel Advisory updated: PNG — Exercise high degree of caution', area: 'PNG', time: '1h ago' },
        { icon: '🟡', title: 'Parliament — AUKUS submarine program costings report', area: 'Canberra', time: '2h ago' },
      ].map((a, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>{a.icon}</span>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{a.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{a.area} · {a.time}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
