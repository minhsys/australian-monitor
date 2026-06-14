import { useState, useMemo } from 'react'

const FILTER_BTNS = [
  { key: 'market',   label: 'MKT',  color: 'var(--accent-cyan)' },
  { key: 'fuel',     label: 'FUEL', color: 'var(--accent-gold)' },
  { key: 'news',     label: 'NEWS', color: 'var(--accent-blue)' },
  { key: 'breaking', label: '🚨',   color: 'var(--accent-red)' },
]

const FUEL_ITEMS = [
  { text: 'ULP Sydney',    val: '185.4¢/L', change: '▼ -0.9¢', cls: 'down' },
  { text: 'ULP Melbourne', val: '179.2¢/L', change: '▼ -1.4¢', cls: 'down' },
  { text: 'ULP Brisbane',  val: '182.6¢/L', change: '',         cls: '' },
  { text: 'ULP Perth',     val: '168.9¢/L', change: '▲ +0.5¢', cls: 'up' },
  { text: 'ULP Adelaide',  val: '177.1¢/L', change: '',         cls: '' },
  { text: 'Diesel Avg',    val: '201.3¢/L', change: '▼ -1.2¢', cls: 'down' },
  { text: 'NSW Spot Power',val: '$78/MWh',  change: '',         cls: '' },
  { text: 'NEM Freq',      val: '49.97 Hz', change: '▲ NORMAL', cls: 'up' },
]

function buildMarketItems(financial) {
  if (!financial) return [{ text: 'MARKETS', val: 'Loading...', change: '', cls: '' }]
  const { asx200, audusd, gold, ironOre, cashRate, crypto } = financial
  return [
    {
      text: 'ASX 200',
      val:  asx200?.value?.toFixed(2) ?? '—',
      change: asx200 ? `${asx200.change >= 0 ? '▲' : '▼'} ${Math.abs(asx200.changePct ?? 0).toFixed(2)}%` : '',
      cls: asx200?.change >= 0 ? 'up' : 'down',
    },
    {
      text: 'AUD/USD',
      val:  audusd?.value?.toFixed(4) ?? '—',
      change: audusd?.change != null ? `${audusd.change >= 0 ? '▲' : '▼'} ${Math.abs(audusd.change).toFixed(4)}` : '',
      cls: audusd?.change >= 0 ? 'up' : 'down',
    },
    {
      text: 'Gold AUD/oz',
      val:  gold?.value ? `$${gold.value}` : '—',
      change: gold?.change != null ? `${gold.change >= 0 ? '▲' : '▼'} $${Math.abs(gold.change)}` : '',
      cls: gold?.change >= 0 ? 'up' : 'down',
    },
    {
      text: 'Iron Ore',
      val:  ironOre?.value ? `$${ironOre.value}/t` : '—',
      change: ironOre?.change != null ? `${ironOre.change >= 0 ? '▲' : '▼'} $${Math.abs(ironOre.change)}` : '',
      cls: ironOre?.change >= 0 ? 'up' : 'down',
    },
    {
      text: 'RBA Cash',
      val:  cashRate?.value ?? '4.35%',
      change: 'TARGET',
      cls: '',
    },
    {
      text: 'BTC',
      val:  crypto?.btc ? `$${Number(crypto.btc).toLocaleString()} AUD` : '—',
      change: crypto?.btcChange != null ? `${crypto.btcChange >= 0 ? '▲' : '▼'} ${Math.abs(crypto.btcChange).toFixed(2)}%` : '',
      cls: crypto?.btcChange >= 0 ? 'up' : 'down',
    },
    {
      text: 'ETH',
      val:  crypto?.eth ? `$${Number(crypto.eth).toLocaleString()} AUD` : '—',
      change: crypto?.ethChange != null ? `${crypto.ethChange >= 0 ? '▲' : '▼'} ${Math.abs(crypto.ethChange).toFixed(2)}%` : '',
      cls: crypto?.ethChange >= 0 ? 'up' : 'down',
    },
  ]
}

function buildNewsItems(newsItems) {
  return (newsItems || []).slice(0, 10).map(item => ({
    text: item.source || 'NEWS',
    val:  item.text,
    change: item.time || '',
    cls: '',
  }))
}

const BREAKING_CATS = new Set(['security', 'emergency', 'cyber', 'defence'])

function buildBreakingItems(newsItems) {
  const hits = (newsItems || []).filter(i => BREAKING_CATS.has(i.cat))
  if (!hits.length) return [{ text: '🚨 STATUS', val: 'No active alerts', change: '', cls: 'alert' }]
  return hits.slice(0, 8).map(item => ({
    text: `🚨 ${item.source}`,
    val:  item.text,
    change: item.time || '',
    cls: 'alert',
  }))
}

export default function BottomTicker({ financial, newsItems }) {
  const [active, setActive] = useState(new Set(['market', 'breaking']))

  const toggleFilter = (key) => {
    setActive(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const items = useMemo(() => {
    const result = []
    if (active.has('market'))   result.push(...buildMarketItems(financial))
    if (active.has('fuel'))     result.push(...FUEL_ITEMS)
    if (active.has('news'))     result.push(...buildNewsItems(newsItems))
    if (active.has('breaking')) result.push(...buildBreakingItems(newsItems))
    return result
  }, [active, financial, newsItems])

  const loopItems = [...items, ...items]

  return (
    <div className="bottom-ticker">
      <div className="ticker-label">
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: '#fff',
          display: 'inline-block', animation: 'pulse-dot 1.5s infinite', flexShrink: 0,
        }} />
        <span style={{ whiteSpace: 'nowrap', marginRight: 4 }}>LIVE</span>
        <div className="ticker-filters">
          {FILTER_BTNS.map(f => (
            <button
              key={f.key}
              className={`ticker-filter-btn${active.has(f.key) ? ' active' : ''}`}
              style={{ '--filter-color': f.color }}
              onClick={() => toggleFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div className="ticker-content" key={Array.from(active).sort().join(',')}>
          {loopItems.map((item, i) => (
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
