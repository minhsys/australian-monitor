import { useMemo } from 'react'
import { Zap } from 'lucide-react'

const FUEL_META = {
  wind:    { label: 'Wind',    color: '#29b6f6' },
  solar:   { label: 'Solar',   color: '#fdd835' },
  hydro:   { label: 'Hydro',   color: '#26c6da' },
  battery: { label: 'Battery', color: '#00e676' },
  gas:     { label: 'Gas',     color: '#ff8f00' },
  coal:    { label: 'Coal',    color: '#546e7a' },
  other:   { label: 'Other',   color: '#78909c' },
}

const REGION_ORDER    = ['NSW', 'VIC', 'QLD', 'SA', 'TAS']
const RENEWABLE_TYPES = new Set(['wind', 'solar', 'hydro', 'battery'])

// SVG ring — green arc = renewables, gray arc = fossil
function RenewableRing({ pct }) {
  const R     = 54
  const cx    = 70
  const cy    = 70
  const circ  = 2 * Math.PI * R
  const renew = ((pct ?? 0) / 100) * circ
  const fossil = circ - renew

  return (
    <svg viewBox="0 0 140 140" width="140" height="140" className="energy-ring">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1a2535" strokeWidth="14" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#546e7a" strokeWidth="14"
        strokeDasharray={`${fossil} ${renew}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="butt"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#00e676" strokeWidth="14"
        strokeDasharray={`${renew} ${fossil}`}
        strokeDashoffset={circ * 0.25 + fossil}
        strokeLinecap="butt"
        style={{ transition: 'stroke-dasharray 1s ease', filter: 'drop-shadow(0 0 6px #00e67688)' }}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#00e676"
        fontSize="22" fontWeight="700" fontFamily="'Share Tech Mono', monospace">
        {pct != null ? pct.toFixed(1) : '--'}%
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#4a6080"
        fontSize="9" fontFamily="'Share Tech Mono', monospace" letterSpacing="1">
        RENEWABLE
      </text>
    </svg>
  )
}

function FuelBar({ fuel, data, maxMw }) {
  const meta      = FUEL_META[fuel] ?? { label: fuel, color: '#888' }
  const mw        = data?.mw  ?? 0
  const pct       = data?.pct ?? 0
  const barW      = maxMw > 0 ? (mw / maxMw * 100) : 0
  const isRenew   = RENEWABLE_TYPES.has(fuel)

  return (
    <div className="fuel-bar-row">
      <div className="fuel-bar-label-wrap">
        <span className="fuel-dot" style={{ background: meta.color }} />
        <span className="fuel-name">{meta.label}</span>
        {isRenew && <span className="fuel-green-tag">♻</span>}
      </div>
      <div className="fuel-bar-track">
        <div className="fuel-bar-fill" style={{
          width: `${barW}%`,
          background: meta.color,
          boxShadow: isRenew ? `0 0 6px ${meta.color}88` : 'none',
          transition: 'width 0.8s ease',
        }} />
      </div>
      <span className="fuel-mw">{mw.toLocaleString()} MW</span>
      <span className="fuel-pct">{pct.toFixed(1)}%</span>
    </div>
  )
}

function RegionRow({ id, data }) {
  const price  = data?.price ?? 0
  const isNeg  = price < 0
  const isHigh = price > 100

  return (
    <div className="region-price-row">
      <span className="region-id">{id}</span>
      <span className="region-demand">{(data?.demand ?? 0).toLocaleString()} MW</span>
      <span className="region-price" style={{
        color: isNeg ? '#29b6f6' : isHigh ? '#ff3d6b' : '#fdd835',
        textShadow: isHigh ? '0 0 8px #ff3d6b88' : 'none',
      }}>
        ${price.toFixed(2)}/MWh
      </span>
    </div>
  )
}

export default function EnergyPanel({ energy }) {
  const gen  = energy?.generation ?? {}
  const regs = energy?.regions    ?? {}

  const fuelOrder = useMemo(() => {
    const renew  = Object.entries(gen).filter(([k]) =>  RENEWABLE_TYPES.has(k)).sort((a, b) => b[1].mw - a[1].mw).map(([k]) => k)
    const fossil = Object.entries(gen).filter(([k]) => !RENEWABLE_TYPES.has(k)).sort((a, b) => b[1].mw - a[1].mw).map(([k]) => k)
    return [...renew, ...fossil]
  }, [gen])

  const maxMw   = Math.max(...Object.values(gen).map(v => v?.mw ?? 0), 1)
  const pct     = energy?.renewables_pct ?? null
  const totalMw = energy?.total_mw ?? 0
  const src     = energy?.source ?? '—'
  const ts      = energy?.updatedAt
    ? new Date(energy.updatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="energy-panel">
      {/* ── Hero ── */}
      <div className="energy-hero">
        <RenewableRing pct={pct} />
        <div className="energy-hero-stats">
          <div className="energy-stat">
            <div className="energy-stat-val">{totalMw.toLocaleString()}</div>
            <div className="energy-stat-label">MW TOTAL DEMAND</div>
          </div>
          <div className="energy-stat">
            <div className="energy-stat-val" style={{ color: 'var(--accent-gold)', fontSize: 11 }}>
              NSW · VIC · QLD · SA · TAS
            </div>
            <div className="energy-stat-label">5 NEM REGIONS</div>
          </div>
          <div className="energy-source-badge">
            <Zap size={8} />
            {src === 'opennem' ? 'OpenNEM / AEMO' : src === 'mock' ? 'MOCK DATA' : src.toUpperCase()}
            <span style={{ color: 'var(--text-dim)' }}> · {ts}</span>
          </div>
        </div>
      </div>

      {/* ── Generation mix ── */}
      <div className="energy-section">
        <div className="energy-section-title">GENERATION MIX</div>
        <div className="fuel-bars">
          {fuelOrder.map(fuel => (
            <FuelBar key={fuel} fuel={fuel} data={gen[fuel]} maxMw={maxMw} />
          ))}
        </div>
      </div>

      {/* ── NEM spot prices ── */}
      <div className="energy-section">
        <div className="energy-section-title">NEM SPOT PRICES</div>
        <div className="region-price-header">
          <span>REGION</span><span>DEMAND</span><span>SPOT $/MWh</span>
        </div>
        {REGION_ORDER.filter(id => regs[id]).map(id => (
          <RegionRow key={id} id={id} data={regs[id]} />
        ))}
        {!REGION_ORDER.some(id => regs[id]) && (
          <div style={{ color: 'var(--text-dim)', fontSize: 10, padding: '8px 0', textAlign: 'center' }}>
            Regional data loading…
          </div>
        )}
      </div>
    </div>
  )
}
