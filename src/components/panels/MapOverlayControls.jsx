import { Layers } from 'lucide-react'

const OVERLAY_ITEMS = [
  { key: 'intelligenceHubs',  icon: '🔵', label: 'Intelligence Hubs' },
  { key: 'liveFlights',       icon: '✈',  label: 'Live Flights (Realtime)' },
  { key: 'trains',            icon: '🚂', label: 'Rail (Simulated)' },
  { key: 'shipping',          icon: '🚢', label: 'Shipping Traffic (AIS)' },
  { key: 'seismic',           icon: '📡', label: 'Seismic (GA + USGS)' },
  { key: 'cameras',           icon: '📷', label: 'Traffic Cameras' },
  { key: 'airports',          icon: '🛫', label: 'Civilian Airports' },
  { key: 'seaports',          icon: '⚓', label: 'International Seaports' },
  { key: 'infrastructure',    icon: '⚡', label: 'National Infrastructure' },
  { key: 'militaryBases',     icon: '🛡', label: 'ADF Bases & Joint Facilities' },
  { key: 'financeLayer',      icon: '💹', label: 'Finance Layer' },
  { key: 'submarineCables',   icon: '🔌', label: 'Submarine Cables' },
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
