import { useEffect, useRef, useState } from 'react'
import MapOverlayControls from './panels/MapOverlayControls.jsx'
import NewsPanel from './panels/NewsPanel.jsx'
import { Layers, Ship, AlertTriangle } from 'lucide-react'

/* ── AU city news-cluster mock data ── */
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

/* ── Static ADF intelligence hub markers ── */
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

const TABS = [
  { id: 'news',      label: '📰 NEWS & AI BRIEF' },
  { id: 'transport', label: '✈ TRANSPORT & MARITIME' },
  { id: 'warning',   label: '⚡ EARLY WARNING & POLICY' },
]

const LAYER_DEFAULTS = {
  intelligenceHubs:  true,
  liveFlights:       true,
  trains:            true,
  shipping:          true,
  seismic:           false,
  cameras:           false,
  airports:          true,
  seaports:          true,
  infrastructure:    false,
  militaryBases:     false,
  financeLayer:      false,
  submarineCables:   false,
}

export default function MapCenter({ newsItems }) {
  const mapRef       = useRef(null)
  const leafletRef   = useRef(null)
  const clustersRef  = useRef([])
  const hubsRef      = useRef([])
  const [activeTab, setActiveTab]   = useState('news')
  const [layers, setLayers]         = useState(LAYER_DEFAULTS)
  const [mapReady, setMapReady]     = useState(false)

  /* ── Init Leaflet map ── */
  useEffect(() => {
    if (leafletRef.current) return // already initialised

    // Dynamic import to avoid SSR issues
    import('leaflet').then(L => {
      const map = L.map('au-map', {
        center: [-25.27, 133.77],
        zoom: 4,
        zoomControl: false,
        attributionControl: true,
      })

      // Dark tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // Zoom control — top left
      L.control.zoom({ position: 'topleft' }).addTo(map)

      leafletRef.current = { map, L }
      mapRef.current = map
      setMapReady(true)

      // Draw initial layers
      drawNewsClusters(map, L)
      drawIntelHubs(map, L)
    })

    return () => {
      if (leafletRef.current) {
        leafletRef.current.map.remove()
        leafletRef.current = null
      }
    }
  }, [])

  /* ── Draw news cluster markers ── */
  function drawNewsClusters(map, L) {
    clustersRef.current.forEach(m => m.remove())
    clustersRef.current = []

    NEWS_CLUSTERS.forEach(city => {
      const size = city.count > 30 ? 32 : city.count > 10 ? 26 : 20
      const icon = L.divIcon({
        className: '',
        html: `<div class="news-cluster-marker ${city.level}"
                    style="width:${size}px;height:${size}px;font-size:${size < 26 ? 9 : 11}px">
                  ${city.count}
               </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })

      const m = L.marker([city.lat, city.lon], { icon })
        .bindTooltip(`<b>${city.name}</b><br/>${city.count} signals`, {
          className: '', direction: 'top', offset: [0, -size / 2]
        })
        .addTo(map)

      clustersRef.current.push(m)
    })
  }

  /* ── Draw intelligence hub markers ── */
  function drawIntelHubs(map, L) {
    hubsRef.current.forEach(m => m.remove())
    hubsRef.current = []

    INTEL_HUBS.forEach(hub => {
      const colours = { SIGINT: '#ff3d6b', RAAF: '#00a8ff', RAN: '#00ffcc', JOINT: '#f5c842', RADAR: '#a078ff' }
      const col = colours[hub.type] || '#888'

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:10px;height:10px;border-radius:50%;
          background:${col};border:1.5px solid rgba(255,255,255,0.4);
          box-shadow:0 0 8px ${col}">
        </div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      })

      const m = L.marker([hub.lat, hub.lon], { icon })
        .bindTooltip(`<b>${hub.name}</b> [${hub.type}]`, { direction: 'top', offset: [0, -8] })
        .addTo(map)

      hubsRef.current.push(m)
    })
  }

  /* ── Toggle overlay layers ── */
  const toggleLayer = (key) => {
    setLayers(prev => {
      const next = { ...prev, [key]: !prev[key] }
      // TODO: show/hide actual Leaflet layer groups
      return next
    })
  }

  return (
    <div className="map-center">
      {/* ── Leaflet map area ── */}
      <div className="map-wrapper">
        <div id="au-map" />

        {/* Scanline + corner decorations */}
        <div className="map-scanlines" />
        <div className="map-corner tl" />
        <div className="map-corner tr" />
        <div className="map-corner bl" />
        <div className="map-corner br" />

        {/* Floating overlay controls */}
        <MapOverlayControls layers={layers} onToggle={toggleLayer} />
      </div>

      {/* ── Bottom tab panel ── */}
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
          {activeTab === 'news'      && <NewsPanel newsItems={newsItems} />}
          {activeTab === 'transport' && <TransportPanel />}
          {activeTab === 'warning'   && <WarningPanel />}
        </div>
      </div>
    </div>
  )
}

/* ── Transport tab placeholder ── */
function TransportPanel() {
  return (
    <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      <div style={{ color: 'var(--accent-cyan)', marginBottom: 8 }}>✈ FIDS — MAJOR AIRPORTS</div>
      {[
        { airport: 'SYD — Kingsford Smith', dep: 142, arr: 138, delayed: 7 },
        { airport: 'MEL — Tullamarine',     dep: 128, arr: 122, delayed: 4 },
        { airport: 'BNE — Brisbane',        dep: 87,  arr: 84,  delayed: 2 },
        { airport: 'PER — Perth',           dep: 64,  arr: 61,  delayed: 3 },
        { airport: 'DRW — Darwin',          dep: 18,  arr: 17,  delayed: 1 },
      ].map(a => (
        <div key={a.airport} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span>{a.airport}</span>
          <span>DEP <span style={{ color: 'var(--accent-blue)' }}>{a.dep}</span></span>
          <span>ARR <span style={{ color: 'var(--accent-cyan)' }}>{a.arr}</span></span>
          <span>DLY <span style={{ color: a.delayed > 5 ? 'var(--accent-red)' : 'var(--accent-orange)' }}>{a.delayed}</span></span>
        </div>
      ))}
    </div>
  )
}

/* ── Early Warning tab placeholder ── */
function WarningPanel() {
  const alerts = [
    { sev: 'HIGH',   icon: '🔴', title: 'BOM — Severe Thunderstorm Warning', area: 'South East QLD', time: '2m ago' },
    { sev: 'MEDIUM', icon: '🟠', title: 'ACSC Alert — Ransomware campaign targeting AU finance sector', area: 'National', time: '18m ago' },
    { sev: 'MEDIUM', icon: '🟠', title: 'DFAT — Travel Advisory updated: PNG — Exercise high degree of caution', area: 'PNG', time: '1h ago' },
    { sev: 'LOW',    icon: '🟡', title: 'Parliament — Senate committee report: AUKUS submarine program costings', area: 'Canberra', time: '2h ago' },
    { sev: 'LOW',    icon: '🟡', title: 'RBA — Governor speech: inflation trajectory remarks', area: 'Sydney', time: '3h ago' },
  ]

  return (
    <div style={{ overflowY: 'auto', padding: '6px 10px', flex: 1 }}>
      {alerts.map((a, i) => (
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
