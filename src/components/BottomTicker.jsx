import { useEffect, useRef } from 'react'

const TICKER_ITEMS = [
  { text: 'ASX 200', val: '8,234.50', change: '▼ -28.15 (-0.34%)', cls: 'down' },
  { text: 'AUD/USD', val: '0.6471', change: '▼ -0.0018', cls: 'down' },
  { text: 'AUD/JPY', val: '96.82', change: '▲ +0.23', cls: 'up' },
  { text: 'Gold AUD/oz', val: '$4,231', change: '▲ +$8', cls: 'up' },
  { text: 'Iron Ore', val: '$103.20/t', change: '▼ -$2.40', cls: 'down' },
  { text: 'LNG (JKM)', val: '$12.80/MMBtu', change: '▲ +$0.35', cls: 'up' },
  { text: 'BTC', val: '$98,240 AUD', change: '▲ +2.14%', cls: 'up' },
  { text: 'ETH', val: '$5,420 AUD', change: '▼ -0.88%', cls: 'down' },
  { text: 'ULP Sydney', val: '185.4¢/L', change: '', cls: '' },
  { text: 'ULP Perth', val: '168.9¢/L', change: '', cls: '' },
  { text: 'RBA Cash Rate', val: '4.35%', change: 'Unchanged', cls: '' },
  { text: '🚨 BOM WARN', val: 'Severe Thunderstorm — SE QLD', change: '', cls: 'alert' },
  { text: 'RAAF Tindal', val: 'Exercise PITCH BLACK — ACTIVE', change: '', cls: 'alert' },
  { text: 'NEM Freq', val: '49.97 Hz', change: '▲ NORMAL', cls: 'up' },
  { text: 'NSW Spot Price', val: '$78/MWh', change: '', cls: '' },
  { text: 'Feeds Active', val: '12/16', change: 'AGGREGATOR LIVE', cls: 'up' },
]

export default function BottomTicker() {
  // Duplicate items for seamless loop
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]

  return (
    <div className="bottom-ticker">
      <div className="ticker-label">
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff',
          display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
        LIVE SIGNALS
      </div>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div className="ticker-content">
          {items.map((item, i) => (
            <span className="ticker-item" key={i}>
              <span style={{ color: 'var(--text-dim)' }}>{item.text}</span>
              <span className="ticker-sep">›</span>
              <span style={{ color: 'var(--text-primary)' }}>{item.val}</span>
              {item.change && (
                <>
                  <span className="ticker-sep">·</span>
                  <span className={item.cls}>{item.change}</span>
                </>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
