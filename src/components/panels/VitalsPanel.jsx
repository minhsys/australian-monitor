import { Flame, Wind, Droplets, Thermometer } from 'lucide-react'

const FIRE_COLORS = {
  'Low-Moderate': '#43a047',
  'High':         '#f9a825',
  'Very High':    '#ef6c00',
  'Severe':       '#c62828',
  'Extreme':      '#6a1b9a',
  'Catastrophic': '#1a0000',
}

const BLEACH_LABELS = ['No Alert', 'Watch', 'Warning', 'Alert Lvl 1', 'Alert Lvl 2']
const BLEACH_COLORS = ['#00e676', '#fdd835', '#ff8f00', '#ff3d6b', '#9c27b0']

const STATE_ORDER = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']

function aqiColor(aqi) {
  if (!aqi) return '#4a6080'
  if (aqi <= 50)  return '#00e676'
  if (aqi <= 100) return '#fdd835'
  if (aqi <= 150) return '#ff8f00'
  if (aqi <= 200) return '#ff3d6b'
  return '#9c27b0'
}

export default function VitalsPanel({ vitals }) {
  const fire = vitals?.fireDanger ?? { ratings: {}, source: 'loading' }
  const aq   = vitals?.airQuality ?? []
  const res  = vitals?.reservoirs?.reservoirs ?? []
  const gbr  = vitals?.gbr ?? {}

  return (
    <div className="vitals-panel">

      {/* ── Fire Danger Ratings ── */}
      <div className="vitals-section">
        <div className="vitals-section-title">
          <Flame size={9} style={{ color: '#ff3d6b' }} />
          STATE FIRE DANGER RATINGS
        </div>
        <div className="fire-grid">
          {STATE_ORDER.map(state => {
            const rating = fire.ratings?.[state] ?? '—'
            const color  = FIRE_COLORS[rating] ?? '#4a6080'
            return (
              <div key={state} className="fire-cell">
                <div className="fire-state">{state}</div>
                <div className="fire-badge" style={{
                  background: `${color}22`,
                  border:     `1px solid ${color}`,
                  color,
                }}>
                  {rating}
                </div>
              </div>
            )
          })}
        </div>
        <div className="vitals-note">
          {fire.source === 'bom' ? '✓ BOM Live' : 'Seasonal model · BOM live unavailable'}
        </div>
      </div>

      {/* ── Air Quality ── */}
      <div className="vitals-section">
        <div className="vitals-section-title">
          <Wind size={9} style={{ color: 'var(--accent-blue)' }} />
          AIR QUALITY (PM2.5 · AQI)
        </div>
        {aq.map(city => {
          const color = aqiColor(city.aqi)
          const barW  = city.aqi ? Math.min(city.aqi / 300 * 100, 100) : 0
          return (
            <div key={city.name} className="aq-row">
              <span className="aq-city">{city.name}</span>
              <div className="aq-bar-track">
                <div className="aq-bar-fill" style={{
                  width: `${barW}%`,
                  background: color,
                  boxShadow: `0 0 4px ${color}88`,
                  transition: 'width 0.8s ease',
                }} />
              </div>
              <span className="aq-val" style={{ color }}>{city.aqi ?? '—'}</span>
              <span className="aq-label" style={{ color }}>{city.label}</span>
            </div>
          )
        })}
        {!aq.length && <div className="vitals-note">Loading…</div>}
        <div className="vitals-note">OpenAQ · PM2.5 µg/m³</div>
      </div>

      {/* ── Reservoir Levels ── */}
      <div className="vitals-section">
        <div className="vitals-section-title">
          <Droplets size={9} style={{ color: '#29b6f6' }} />
          DAM / RESERVOIR STORAGE
        </div>
        {res.map(r => {
          const color = r.pct > 60 ? '#00e676' : r.pct > 30 ? '#fdd835' : '#ff3d6b'
          return (
            <div key={r.name} className="reservoir-row">
              <div className="reservoir-name-wrap">
                <span className="reservoir-dam">{r.name}</span>
                <span className="reservoir-city">{r.city}</span>
              </div>
              <div className="reservoir-bar-track">
                <div className="reservoir-bar-fill" style={{
                  width: `${r.pct}%`,
                  background: color,
                  boxShadow: `0 0 4px ${color}66`,
                  transition: 'width 0.8s ease',
                }} />
              </div>
              <span className="reservoir-pct" style={{ color }}>{r.pct}%</span>
            </div>
          )
        })}
        <div className="vitals-note">
          {vitals?.reservoirs?.source === 'bom' ? '✓ BOM WaterData' : 'Indicative · real-time feeds pending'}
        </div>
      </div>

      {/* ── Great Barrier Reef SST ── */}
      <div className="vitals-section">
        <div className="vitals-section-title">
          <Thermometer size={9} style={{ color: '#ff8f00' }} />
          GREAT BARRIER REEF — SST
        </div>
        <div className="gbr-row">
          <div className="gbr-temp-block">
            <div className="gbr-temp">
              {gbr.sst != null ? `${gbr.sst}°C` : '—'}
            </div>
            <div className="gbr-anomaly" style={{
              color: (gbr.anomaly ?? 0) > 1 ? '#ff3d6b' : '#00e676',
            }}>
              {gbr.anomaly != null
                ? `${gbr.anomaly > 0 ? '+' : ''}${gbr.anomaly}°C anomaly`
                : '—'}
            </div>
          </div>
          <div className="gbr-alert-badge" style={{
            background: `${BLEACH_COLORS[gbr.bleachingAlert ?? 0]}33`,
            border:     `1px solid ${BLEACH_COLORS[gbr.bleachingAlert ?? 0]}`,
            color:       BLEACH_COLORS[gbr.bleachingAlert ?? 0],
          }}>
            {BLEACH_LABELS[gbr.bleachingAlert ?? 0] ?? 'Unknown'}
          </div>
        </div>
        <div className="vitals-note">
          {gbr.source === 'noaa'
            ? '✓ NOAA CoralWatch · Live'
            : 'Seasonal estimate · NOAA CoralWatch'}
        </div>
      </div>
    </div>
  )
}
