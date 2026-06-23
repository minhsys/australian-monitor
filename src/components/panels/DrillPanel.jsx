const fmtArea = sqKm => sqKm != null ? `${sqKm.toLocaleString('en-AU', { maximumFractionDigits: 1 })} km²` : '—'

export default function DrillPanel({ drill, stats, onNavigate }) {
  if (drill.level === 'country') return null

  return (
    <div className="drill-panel">
      <div className="drill-breadcrumb">
        <button className="drill-crumb" onClick={() => onNavigate('country')}>Australia</button>
        {drill.state && (
          <>
            <span className="drill-sep">›</span>
            <button
              className={`drill-crumb${drill.level === 'state' ? ' active' : ''}`}
              onClick={() => onNavigate('state')}
            >
              {drill.state.name}
            </button>
          </>
        )}
        {drill.sa2 && (
          <>
            <span className="drill-sep">›</span>
            <span className="drill-crumb active">{drill.sa2.name}</span>
          </>
        )}
      </div>

      {stats && (
        <div className="drill-stats">
          <div className="drill-stat-area">{fmtArea(stats.areaSqKm)}</div>
          <div className="drill-stat-row"><span>🚨 Active incidents</span><span>{stats.emergencyAlerts}</span></div>
          <div className="drill-stat-row"><span>🚧 Road closures</span><span>{stats.roadClosures}</span></div>
          <div className="drill-stat-row"><span>🔥 Fire hotspots</span><span>{stats.fires}</span></div>
          <div className="drill-stat-row"><span>🌊 Flood warnings</span><span>{stats.floods}</span></div>
          {drill.level === 'state' && <div className="drill-hint">Click a suburb to drill down further</div>}
        </div>
      )}
    </div>
  )
}
