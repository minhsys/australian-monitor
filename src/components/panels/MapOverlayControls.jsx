import { Layers } from 'lucide-react'

const OVERLAY_ITEMS = [
  { key: 'liveFlights',       icon: '✈',  label: 'Live Flights (Realtime)' },
  { key: 'shipping',          icon: '🚢', label: 'Shipping Traffic (AIS)' },
  { key: 'seismic',           icon: '📡', label: 'Seismic (GA + USGS)' },
  { key: 'airports',          icon: '🛫', label: 'Civilian Airports' },
  { key: 'seaports',          icon: '⚓', label: 'International Seaports' },
  { key: 'infrastructure',    icon: '⚡', label: 'National Infrastructure' },
  { key: 'trains',            icon: '🚂', label: 'Rail Routes' },
  { key: 'submarineCables',   icon: '🔌', label: 'Submarine Cables' },
  { key: 'fires',             icon: '🔥', label: 'Bushfire Hotspots (NASA)' },
  { key: 'floods',            icon: '🌊', label: 'Flood Warnings (BOM)' },
]

export default function MapOverlayControls({ layers, onToggle }) {
  return (
    <div className="map-overlay-panel">
      <div className="overlay-panel-title">
        <Layers size={10} />
        MAP OVERLAYS
      </div>
      {OVERLAY_ITEMS.map(item => (
        <div
          key={item.key}
          className="overlay-item"
          onClick={() => onToggle(item.key)}
        >
          <div className={`overlay-checkbox ${layers[item.key] ? 'checked' : ''}`} />
          <span className="overlay-icon">{item.icon}</span>
          <span className="overlay-label">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
