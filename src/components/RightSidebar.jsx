import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, BarChart2, Zap } from 'lucide-react'
import EnergyPanel  from './panels/EnergyPanel.jsx'
import VitalsPanel  from './panels/VitalsPanel.jsx'

/* ── Mock financial data (replace with Yahoo Finance / RBA API in Phase 3) ── */
const MOCK_FINANCIAL = {
  asx200: { value: 8234.50, change: -28.15, changePct: -0.34 },
  turnover: { value: 6.24, unit: '$B', changeLabel: '+8.2% vs avg', low: '3.1B', mid: '5.8B', high: '9.2B+' },
  marginLending: { value: '$42.3B', label: '+3.1% QoQ' },
  cashRate: { value: '4.35%', label: 'RBA target' },
  sectors: [
    { name: 'Materials (Mining)',   pct: 24.1, val: '$1.48B' },
    { name: 'Financials (Banks)',   pct: 21.8, val: '$1.34B' },
    { name: 'Real Estate (REITs)', pct: 15.3, val: '$0.94B' },
    { name: 'Energy (LNG/Coal)',    pct: 12.7, val: '$0.78B' },
    { name: 'Health Care',          pct: 10.2, val: '$0.63B' },
    { name: 'Other',                pct: 15.9, val: '$0.97B' },
  ],
  netflowETF: [
    { name: 'VAS (Vanguard AU)',   val: '+$38M', pos: true },
    { name: 'IOZ (iShares)',       val: '+$22M', pos: true },
    { name: 'STW (SPDR AU)',       val: '+$15M', pos: true },
    { name: 'GDX (Gold Miners)',   val: '-$8M',  pos: false },
  ],
  foreignFlow: [
    { ticker: 'BHP',  val: '+$82M', pos: true },
    { ticker: 'CBA',  val: '+$55M', pos: true },
    { ticker: 'RIO',  val: '+$41M', pos: true },
    { ticker: 'WBC',  val: '-$28M', pos: false },
    { ticker: 'ANZ',  val: '-$19M', pos: false },
  ],
  instFlow: [
    { ticker: 'CSL',  val: '+$44M', pos: true },
    { ticker: 'WDS',  val: '+$31M', pos: true },
    { ticker: 'MQG',  val: '-$22M', pos: false },
    { ticker: 'WES',  val: '-$12M', pos: false },
    { ticker: 'NAB',  val: '-$9M',  pos: false },
  ],
  crypto: { btc: 98240, eth: 5420, btcChange: +2.14, ethChange: -0.88 },
  audusd: { value: 0.6471, change: -0.0018 },
  gold: { value: 4231, change: +8 },
  ironOre: { value: 103.20, change: -2.40 },
}

/* ── Simple sparkline SVG ── */
function Sparkline({ data, up, width = 180, height = 44 }) {
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 6) - 3
    return `${x},${y}`
  }).join(' ')
  const area = `M${pts.replace(/,(\S+)/g, ' $1 L').replace(/ L$/, '')} L${width},${height} L0,${height} Z`
  const color = up ? 'var(--accent-green)' : 'var(--accent-red)'
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spkGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spkGrad)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

/* random walk for sparkline demo */
function mockSparkData(base, n = 24) {
  return Array.from({ length: n }, (_, i) =>
    base + (Math.sin(i * 0.4) * 40) + (Math.random() - 0.5) * 20
  )
}

const ASX_SPARK = mockSparkData(8234)

const TABS = ['MONEY FLOW', 'ASX SECTORS', 'RBA & MACRO', 'ENERGY GRID', 'VITALS']

export default function RightSidebar({ financial, energy, absData, vitals }) {
  const [activeTab, setActiveTab] = useState(0)
  const data = financial ? { ...MOCK_FINANCIAL, ...financial } : MOCK_FINANCIAL
  const up = data.asx200.change >= 0

  return (
    <aside className="right-sidebar">
      {/* ── Header ── */}
      <div className="fin-header">
        {activeTab === 3
          ? <><Zap size={14} color="var(--accent-green)" /> AEMO LIVE ENERGY GRID</>
          : activeTab === 4
          ? <><Zap size={14} color="var(--accent-red)" /> AUSTRALIAN VITALS</>
          : <><BarChart2 size={14} color="var(--accent-gold)" /> ASX FINANCIAL MARKETS</>
        }
      </div>

      {/* ── Tabs ── */}
      <div className="fin-tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`fin-tab ${activeTab === i ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}>{t}</button>
        ))}
      </div>

      <div className="fin-body">
        {/* ── ASX 200 hero (always visible) ── */}
        <div className="index-hero">
          <div className="index-label">CHỈ SỐ THỊ TRƯỜNG / BENCHMARK INDEX</div>
          <div className="index-name">S&amp;P / ASX 200</div>
          <div className="index-value-row">
            <span className="index-value">{data.asx200.value.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            <span className={`index-change ${up ? 'up' : 'down'}`}>
              {up ? '▲' : '▼'} {Math.abs(data.asx200.change).toFixed(2)}<br />
              ({up ? '+' : ''}{data.asx200.changePct.toFixed(2)}%)
            </span>
          </div>
          <div className="sparkline-wrap">
            <Sparkline data={ASX_SPARK} up={up} />
          </div>
        </div>

        {/* ── TAB 0: Money Flow ── */}
        {activeTab === 0 && (
          <>
            {/* Market turnover */}
            <div className="fin-section">
              <div className="fin-section-title">TOTAL MARKET TURNOVER</div>
              <div>
                <span className="turnover-value">{data.turnover.value}{data.turnover.unit}</span>
                <span className="turnover-sub">{data.turnover.changeLabel}</span>
              </div>
              <div className="turnover-bar-wrap">
                <span className="turnover-bar-label">{data.turnover.low}</span>
                <div className="turnover-bar-track">
                  <div className="turnover-bar-fill" style={{ width: '56%' }} />
                </div>
                <span className="turnover-bar-label">{data.turnover.mid}</span>
                <div className="turnover-bar-track">
                  <div className="turnover-bar-fill" style={{ width: '78%' }} />
                </div>
                <span className="turnover-bar-label">{data.turnover.high}</span>
              </div>
            </div>

            {/* Macro cards */}
            <div className="fin-section">
              <div className="fin-section-title">MACRO INDICATORS</div>
              <div className="macro-row">
                <div className="macro-card">
                  <div className="macro-card-label">MARGIN LENDING (AU)</div>
                  <div className="macro-card-value">{data.marginLending.value}</div>
                  <div className="macro-card-sub up">{data.marginLending.label}</div>
                </div>
                <div className="macro-card">
                  <div className="macro-card-label">RBA CASH RATE</div>
                  <div className="macro-card-value">{data.cashRate.value}</div>
                  <div className="macro-card-sub" style={{ color: 'var(--text-muted)' }}>{data.cashRate.label}</div>
                </div>
                <div className="macro-card">
                  <div className="macro-card-label">AUD / USD</div>
                  <div className="macro-card-value">{data.audusd.value.toFixed(4)}</div>
                  <div className={`macro-card-sub ${data.audusd.change >= 0 ? 'up' : 'down'}`}>
                    {data.audusd.change >= 0 ? '+' : ''}{data.audusd.change.toFixed(4)}
                  </div>
                </div>
                <div className="macro-card">
                  <div className="macro-card-label">GOLD AUD/oz</div>
                  <div className="macro-card-value">${data.gold.value.toLocaleString()}</div>
                  <div className={`macro-card-sub ${data.gold.change >= 0 ? 'up' : 'down'}`}>
                    {data.gold.change >= 0 ? '+' : ''}${data.gold.change}
                  </div>
                </div>
              </div>
            </div>

            {/* ETF Net Flows */}
            <div className="fin-section">
              <div className="fin-section-title">ETF NET FLOWS</div>
              {data.netflowETF.map(f => (
                <div className="netflow-row" key={f.name}>
                  <span className="netflow-name">{f.name}</span>
                  <span className={`netflow-val ${f.pos ? 'pos' : 'neg'}`}>{f.val}</span>
                </div>
              ))}
            </div>

            {/* Foreign vs institutional flows */}
            <div className="fin-section">
              <div className="fin-section-title">INSTITUTIONAL FLOWS</div>
              <div className="buysell-grid">
                <div>
                  <div className="buysell-col-title">FOREIGN BUY/SELL</div>
                  {data.foreignFlow.map(f => (
                    <div className="buysell-row" key={f.ticker}>
                      <span className="buysell-ticker">{f.ticker}</span>
                      <span className={`buysell-val ${f.pos ? 'buy' : 'sell'}`}>{f.val}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="buysell-col-title">FUND MGR FLOWS</div>
                  {data.instFlow.map(f => (
                    <div className="buysell-row" key={f.ticker}>
                      <span className="buysell-ticker">{f.ticker}</span>
                      <span className={`buysell-val ${f.pos ? 'buy' : 'sell'}`}>{f.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── TAB 1: ASX Sectors ── */}
        {activeTab === 1 && (
          <>
            <div className="fin-section">
              <div className="fin-section-title">SECTOR MONEY FLOW DISTRIBUTION</div>
              {data.sectors.map(s => (
                <div className="sector-row" key={s.name}>
                  <span className="sector-name">{s.name}</span>
                  <div className="sector-bar-track">
                    <div className="sector-bar-fill" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="sector-pct">{s.val}</span>
                  <span className="sector-pct" style={{ width: 32 }}>{s.pct}%</span>
                </div>
              ))}
            </div>

            {/* Commodity spot prices */}
            <div className="fin-section">
              <div className="fin-section-title">KEY COMMODITY PRICES (AU EXPORT)</div>
              {[
                { name: 'Iron Ore (62% Fe)', val: `$${data.ironOre.value}/t`, chg: data.ironOre.change, up: data.ironOre.change >= 0 },
                { name: 'LNG (JKM Spot)',    val: '$12.80/MMBtu',   chg: +0.35, up: true },
                { name: 'Thermal Coal (NC)', val: '$138.50/t',      chg: -2.10, up: false },
                { name: 'Copper (LME)',      val: '$9,240/t',       chg: +18,   up: true },
                { name: 'Gold (Spot USD)',   val: `$${(data.gold.value / 1.55).toFixed(0)}/oz`, chg: data.gold.change, up: data.gold.change >= 0 },
                { name: 'Lithium Carb.',     val: '$11,400/t',      chg: -240,  up: false },
              ].map(c => (
                <div className="netflow-row" key={c.name}>
                  <span className="netflow-name">{c.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{c.val}</span>
                  <span className={`netflow-val ${c.up ? 'pos' : 'neg'}`}>
                    {c.up ? '+' : ''}{typeof c.chg === 'number' ? c.chg.toFixed(c.chg > 10 ? 0 : 2) : c.chg}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── TAB 2: RBA & Macro ── */}
        {activeTab === 2 && (
          <>
            <div className="fin-section">
              <div className="fin-section-title">
                RBA DASHBOARD
                {absData && <span className="abs-live-badge">ABS LIVE</span>}
              </div>
              {[
                {
                  label: 'Cash Rate Target',
                  val:   data.cashRate?.value ?? '4.35%',
                  note:  'RBA target rate',
                },
                {
                  label: 'CPI (All Groups)',
                  val:   absData?.cpi?.value != null ? `${absData.cpi.value}%` : '—',
                  note:  absData?.cpi?.period ?? 'ABS',
                  live:  !!absData?.cpi?.value,
                },
                {
                  label: 'Unemployment Rate',
                  val:   absData?.unemployment?.value != null ? `${absData.unemployment.value}%` : '—',
                  note:  absData?.unemployment?.period ?? 'ABS LF',
                  live:  !!absData?.unemployment?.value,
                },
                {
                  label: 'GDP Growth (YoY)',
                  val:   absData?.gdpGrowth?.value != null ? `${absData.gdpGrowth.value}%` : '—',
                  note:  absData?.gdpGrowth?.period ?? 'ABS NA',
                  live:  !!absData?.gdpGrowth?.value,
                },
                {
                  label: 'Population',
                  val:   absData?.population?.value != null ? `${absData.population.value}M` : '—',
                  note:  absData?.population?.period ?? 'ABS ERP',
                  live:  !!absData?.population?.value,
                },
                {
                  label: 'Trade Balance',
                  val:   absData?.tradeBalance?.value != null
                    ? `${absData.tradeBalance.value >= 0 ? '+' : ''}$${absData.tradeBalance.value}B`
                    : '—',
                  note:  absData?.tradeBalance?.period ?? 'ABS BOP',
                  live:  !!absData?.tradeBalance?.value,
                },
              ].map(r => (
                <div className="netflow-row" key={r.label}>
                  <span className="netflow-name" style={{ width: 155, flex: 'none' }}>{r.label}</span>
                  <span style={{
                    color: r.live ? 'var(--accent-cyan)' : 'var(--accent-gold)',
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                  }}>{r.val}</span>
                  {r.live && <span style={{ color: 'var(--text-muted)', fontSize: 9, marginLeft: 4 }}>{r.note}</span>}
                </div>
              ))}
            </div>

            <div className="fin-section">
              <div className="fin-section-title">CRYPTO (AUD)</div>
              {[
                { name: 'Bitcoin (BTC)', val: `$${data.crypto.btc.toLocaleString()} AUD`, chg: data.crypto.btcChange, up: data.crypto.btcChange >= 0 },
                { name: 'Ethereum (ETH)', val: `$${data.crypto.eth.toLocaleString()} AUD`, chg: data.crypto.ethChange, up: data.crypto.ethChange >= 0 },
              ].map(c => (
                <div className="netflow-row" key={c.name}>
                  <span className="netflow-name">{c.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{c.val}</span>
                  <span className={`netflow-val ${c.up ? 'pos' : 'neg'}`}>
                    {c.up ? '+' : ''}{c.chg.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── TAB 3: ENERGY GRID ── */}
        {activeTab === 3 && <EnergyPanel energy={energy} />}

        {/* ── TAB 4: VITALS ── */}
        {activeTab === 4 && <VitalsPanel vitals={vitals} />}
      </div>
    </aside>
  )
}
