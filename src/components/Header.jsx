import { useState, useEffect } from 'react'
import { Activity, Wifi, Rss, Globe } from 'lucide-react'

export default function Header({ feedStats, threatIndex, onThreatClick }) {
  const [time, setTime]           = useState(new Date())
  const [linkStatus, setLinkStatus] = useState('ONLINE')

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const aestTime = time.toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Sydney',
    hour12: false,
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })

  return (
    <header className="header">
      {/* ── Left: logo + title ── */}
      <div className="header-left">
        <div className="header-logo">🇦🇺</div>
        <div>
          <div className="header-title">Australia Intelligence Monitor</div>
          <div className="header-subtitle">
            Real-time Geopolitical &amp; Strategic Intelligence Aggregator
          </div>
        </div>
      </div>

      {/* ── Right: status indicators ── */}
      <div className="header-right">
        {/* Threat Level Index */}
        {threatIndex?.overall && (
          <div
            className="header-stat threat-badge"
            style={{ color: threatIndex.overall.color, cursor: 'pointer' }}
            onClick={onThreatClick}
            role="button"
            tabIndex={0}
            title="Jump to Early Warning & Policy"
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onThreatClick?.() }}
          >
            <span className="dot" style={{ background: threatIndex.overall.color, boxShadow: `0 0 6px ${threatIndex.overall.color}` }} />
            <Activity size={11} />
            <span className="header-stat-label" style={{ color: threatIndex.overall.color }}>
              THREAT: {threatIndex.overall.label.toUpperCase()}
            </span>
          </div>
        )}

        {/* OSINT Pulse */}
        <div className="header-stat">
          <Globe size={11} />
          <span className="header-stat-label">STRATEGIC &amp; PACIFIC PULSE</span>
        </div>

        {/* Link status */}
        <div className="header-stat">
          <span className="dot" />
          <Activity size={11} />
          <span className="header-stat-label">LINK {linkStatus}</span>
        </div>

        {/* Feeds scanned */}
        <div className="header-stat">
          <Rss size={11} />
          <span>FEEDS SCANNED:</span>
          <span className="header-stat-label">{feedStats?.online ?? 12}/{feedStats?.total ?? 16}</span>
        </div>

        {/* Clock (AEST) */}
        <div className="header-stat" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-cyan)' }}>
          AEST {aestTime}
        </div>
      </div>
    </header>
  )
}
