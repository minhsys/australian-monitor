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
  JOINT:  '#f5c842',
  RADAR:  '#a078ff',
}

const FINANCE_MARKERS = [
  { name: 'ASX Sydney',           lat: -33.868, lon: 151.207, type: 'exchange',  icon: '💹' },
  { name: 'Reserve Bank of AU',   lat: -33.870, lon: 151.213, type: 'central',   icon: '🏦' },
  { name: 'Port Hedland Iron',    lat: -20.315, lon: 118.577, type: 'commodity', icon: '⛏' },
  { name: 'Curtis Is. LNG',       lat: -23.856, lon: 151.254, type: 'commodity', icon: '🔶' },
  { name: 'Kalgoorlie Gold',      lat: -30.750, lon: 121.466, type: 'commodity', icon: '🥇' },
  { name: 'Newcastle Coal',       lat: -32.913, lon: 151.796, type: 'commodity', icon: '⚫' },
  { name: 'Pilgangoora Lithium',  lat: -21.715, lon: 118.670, type: 'commodity', icon: '⚡' },
  { name: 'BHP (Melbourne)',      lat: -37.820, lon: 144.964, type: 'corporate', icon: '🏢' },
  { name: 'Rio Tinto (Perth)',    lat: -31.956, lon: 115.860, type: 'corporate', icon: '🏢' },
]

const FINANCE_COLOURS = {
  exchange:  '#f5c842',
  central:   '#ff3d6b',
  commodity: '#ff8800',
  corporate: '#00a8ff',
}

const TABS = [
  { id: 'news',      label: '📰 NEWS & AI BRIEF' },
  { id: 'transport', label: '✈ TRANSPORT & MARITIME' },
  { id: 'warning',   label: '⚡ EARLY WARNING & POLICY' },
]

const LAYER_DEFAULTS = {
  intelligenceHubs: true,
  liveFlights:      true,
  trains:           true,
  shipping:         true,
  seismic:          false,
  cameras:          false,
  airports:         true,
  seaports:         true,
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

function drawFinanceLayer(group) {
  FINANCE_MARKERS.forEach(m => {
    const col = FINANCE_COLOURS[m.type] || '#888'
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        background:${col}22;border:1.5px solid ${col};border-radius:3px;
        padding:2px 5px;font-size:9px;white-space:nowrap;
        color:${col};font-family:monospace;
        box-shadow:0 0 6px ${col}66;line-height:1.4">
        ${m.icon} ${m.name}
      </div>`,
      iconAnchor: [0, 0],
    })
    L.marker([m.lat, m.lon], { icon })
      .bindTooltip(`<b>${m.name}</b><br/>[${m.type.toUpperCase()}]`, { direction: 'top', offset: [0, -8] })
      .addTo(group)
  })
}

function drawSubmarineCables(group, { cables: cableGeo, landings: landingGeo }) {
  L.geoJSON(cableGeo, {
    style: feature => ({
      color: feature.properties?.color || '#00a8ff',
      weight: 1.5,
      opacity: 0.65,
    }),
    onEachFeature: (feature, layer) => {
      if (feature.properties?.name) {
        layer.bindTooltip(`📡 ${feature.properties.name}`, { sticky: true })
      }
    },
  }).addTo(group)

  landingGeo.features.forEach(f => {
    const [lon, lat] = f.geometry.coordinates
    L.circleMarker([lat, lon], {
      radius: 5,
      fillColor: '#00ffcc',
      color: '#00ffcc',
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.85,
    })
      .bindTooltip(`🔌 ${f.properties?.name || 'Landing Point'}`, { direction: 'top', offset: [0, -8] })
      .addTo(group)
  })
}

/* ── Component ── */
export default function MapCenter({ newsItems, flights, ships, seismic, fires, fids, aiBrief }) {
  const mapRef     = useRef(null)
  const groupsRef  = useRef({})
  const wrapperRef = useRef(null)
  const [activeTab, setActiveTab] = useState('news')
  const [layers, setLayers]       = useState(LAYER_DEFAULTS)
  const [cables, setCables]       = useState(null)

  /* ── Init map once ── */
  useEffect(() => {
    if (mapRef.current) return

    const map = L.map('au-map', {
      center: [-25.27, 133.77],
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

    const groups = {
      newsClusters:     L.layerGroup().addTo(map),
      intelligenceHubs: L.layerGroup().addTo(map),
      liveFlights:      L.layerGroup().addTo(map),
      shipping:         L.layerGroup().addTo(map),
      fires:            L.layerGroup().addTo(map),
      seismic:          L.layerGroup(),    // default off
      financeLayer:     L.layerGroup(),    // default off
      submarineCables:  L.layerGroup(),    // default off
    }

    groupsRef.current = groups
    mapRef.current    = map

    drawNewsClusters(groups.newsClusters)
    drawIntelHubs(groups.intelligenceHubs)
    drawFinanceLayer(groups.financeLayer)

    // Pre-fetch cable data so it's ready when the layer is toggled on
    fetch('/api/cables')
      .then(r => r.json())
      .then(setCables)
      .catch(err => console.warn('[CABLES] fetch failed:', err))

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

  useEffect(() => {
    const g = groupsRef.current.submarineCables
    if (!g) return
    g.clearLayers()
    if (layers.submarineCables && cables) {
      drawSubmarineCables(g, cables)
    }
  }, [cables, layers.submarineCables])

  /* ── Leaflet resize sync when panel is resized ── */
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
      <div className="map-wrapper" ref={wrapperRef}>
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
  const airports = Object.values(fids || {})
  const hasFids  = airports.length > 0

  return (
    <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <span style={{ color: 'var(--accent-cyan)' }}>✈ {flights?.length ?? 0} aircraft</span>
        <span style={{ color: 'var(--accent-green)' }}>🚢 {ships?.length ?? 0} vessels</span>
      </div>
      <div style={{ color: 'var(--accent-cyan)', marginBottom: 8 }}>
        FIDS — MAJOR AIRPORTS {!hasFids && <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>(AIRLABS_KEY required)</span>}
      </div>
      {hasFids
        ? airports.map(a => (
            <div key={a.iata} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.iata} — {a.name}</span>
              <span>DEP <span style={{ color: 'var(--accent-blue)' }}>{a.departures}</span></span>
              <span>DLY <span style={{ color: a.delayed > 5 ? 'var(--accent-red)' : 'var(--accent-orange)' }}>{a.delayed}</span></span>
            </div>
          ))
        : [
            { iata: 'SYD', name: 'Kingsford Smith', dep: 142, delayed: 7 },
            { iata: 'MEL', name: 'Tullamarine',     dep: 128, delayed: 4 },
            { iata: 'BNE', name: 'Brisbane',        dep: 87,  delayed: 2 },
            { iata: 'PER', name: 'Perth',           dep: 64,  delayed: 3 },
            { iata: 'DRW', name: 'Darwin',          dep: 18,  delayed: 1 },
          ].map(a => (
            <div key={a.iata} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: 0.5 }}>
              <span style={{ width: 140 }}>{a.iata} — {a.name}</span>
              <span>DEP <span style={{ color: 'var(--accent-blue)' }}>{a.dep}</span></span>
              <span>DLY <span style={{ color: 'var(--accent-orange)' }}>{a.delayed}</span></span>
            </div>
          ))
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
        <div style={{ marginBottom: 6, color: 'var(--accent-orange)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
          RECENT SEISMIC ACTIVITY
        </div>
      )}
      {recentQuakes.map((e, i) => (
        <div key={e.id ?? i} style={{ display: 'flex', gap: 8, padding: '4px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 12, flexShrink: 0 }}>📡</span>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>M{e.magnitude?.toFixed(1)} — {e.place}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>Depth: {e.depth}km</div>
          </div>
        </div>
      ))}
      {[
        { icon: '🟠', title: 'ACSC Alert — Ransomware campaign targeting AU finance sector', area: 'National', time: '18m ago' },
        { icon: '🟠', title: 'DFAT — Travel Advisory updated: PNG — Exercise high degree of caution', area: 'PNG', time: '1h ago' },
        { icon: '🟡', title: 'Parliament — AUKUS submarine program costings report', area: 'Canberra', time: '2h ago' },
      ].map((a, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 12, flexShrink: 0 }}>{a.icon}</span>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>{a.title}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{a.area} · {a.time}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
