import { useState } from 'react'
import { Search, RefreshCw, Bot } from 'lucide-react'

const CATEGORIES = ['All Feeds', 'Security', 'Economy', 'Defence', 'Politics', 'Pacific', 'Cyber', 'Emergency']

const MOCK_NEWS = [
  { id: 1, cat: 'defence',   source: 'DoD Australia',   origin: 'domestic', time: '3m ago',  text: 'RAAF F-35As complete joint exercise with USAF at Tindal — largest air combat training package in NT history' },
  { id: 2, cat: 'economy',   source: 'AFR',             origin: 'domestic', time: '7m ago',  text: 'ASX 200 opens lower as iron ore futures slide on softer Chinese PMI data; BHP, RIO lead losses in resources sector' },
  { id: 3, cat: 'security',  source: 'ABC News',        origin: 'domestic', time: '11m ago', text: 'AFP and ASIO joint operation disrupts espionage network linked to foreign state actor; two individuals charged' },
  { id: 4, cat: 'pacific',   source: 'RNZ Pacific',     origin: 'overseas', time: '18m ago', text: 'Solomon Islands PM signals review of Chinese security agreement terms — Canberra welcomes dialogue opportunity' },
  { id: 5, cat: 'cyber',     source: 'ACSC',            origin: 'domestic', time: '22m ago', text: 'ASD Advisory: Active exploitation of critical vulnerability in widely-used AU government software — patch immediately' },
  { id: 6, cat: 'emergency', source: 'BOM',             origin: 'domestic', time: '29m ago', text: 'Severe Thunderstorm Warning issued for South East QLD including Brisbane, Gold Coast — damaging winds, large hail' },
  { id: 7, cat: 'politics',  source: 'SMH',             origin: 'domestic', time: '34m ago', text: 'Senate Armed Services Committee grills Defence over AUKUS submarine cost blowout — billions over initial estimate' },
  { id: 8, cat: 'economy',   source: 'RBA',             origin: 'domestic', time: '41m ago', text: 'RBA Governor: inflation returning to target band — board monitoring labour market data ahead of August decision' },
  { id: 9, cat: 'pacific',   source: 'ABC Pacific',     origin: 'domestic', time: '55m ago', text: 'PNG security forces deployed to Highlands following renewed inter-tribal conflict; AU deployment assessed unlikely' },
  { id: 10,cat: 'security',  source: 'ASPI Strategist', origin: 'domestic', time: '1h ago',  text: 'Analysis: Chinese naval activity in Coral Sea up 40% year-on-year — cable infrastructure proximity a concern' },
]

const CAT_CLASSES = {
  security: 'cat-security', economy: 'cat-economy', defence: 'cat-defence',
  politics: 'cat-politics', pacific: 'cat-pacific', cyber: 'cat-cyber', emergency: 'cat-emergency'
}

export default function NewsPanel({ newsItems, aiBrief }) {
  const [activeSource, setActiveSource]   = useState('domestic')
  const [activeCategory, setActiveCategory] = useState('All Feeds')
  const [searchQuery, setSearchQuery]     = useState('')
  const [briefExpanded, setBriefExpanded] = useState(true)

  const items = newsItems?.length ? newsItems : MOCK_NEWS

  const filtered = items.filter(item => {
    const matchSource = !item.origin || item.origin === activeSource
    const matchCat  = activeCategory === 'All Feeds' || item.cat.toLowerCase() === activeCategory.toLowerCase()
    const matchSearch = !searchQuery || item.text.toLowerCase().includes(searchQuery.toLowerCase())
    return matchSource && matchCat && matchSearch
  })

  return (
    <div className="news-panel">
      {/* ── Top controls ── */}
      <div className="news-panel-top">
        <div className="ai-desk-title">
          <Bot size={12} />
          AI INTELLIGENCE DESK
        </div>

        <button className="reanalyze-btn" onClick={() => fetch('/api/force-brief', { method: 'POST' }).catch(() => {})}>
          <RefreshCw size={9} />
          Re-Analyse
        </button>

        <div className="news-search">
          <Search size={10} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search tactical feeds..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="feed-source-btns">
          <button
            className={`feed-source-btn ${activeSource === 'domestic' ? 'active' : ''}`}
            onClick={() => setActiveSource('domestic')}
          >
            ☐ Domestic Media
          </button>
          <button
            className={`feed-source-btn ${activeSource === 'overseas' ? 'active' : ''}`}
            onClick={() => setActiveSource('overseas')}
          >
            ☐ Overseas Media
          </button>
        </div>
      </div>

      {/* ── Category filter tabs ── */}
      <div className="news-filter-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`news-filter-tab ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── AI Brief (collapsible) ── */}
      {briefExpanded && activeCategory === 'All Feeds' && (
        <div className="ai-brief" onClick={() => setBriefExpanded(false)} style={{ cursor: 'pointer' }}>
          {aiBrief
            ? aiBrief.brief
            : 'Generating intelligence brief…'
          }
          <div className="ai-brief-status">
            {aiBrief
              ? `↳ ${aiBrief.model.toUpperCase()} · Generated: ${new Date(aiBrief.generatedAt).toLocaleTimeString('en-AU', { hour12: false })} · click to collapse`
              : '↳ STATUS: PENDING · AI Standby'
            }
          </div>
        </div>
      )}

      {/* ── News feed list ── */}
      <div className="news-feed-list">
        {filtered.map((item, idx) => (
          <div className="news-item" key={`${item.id}-${idx}`}>
            <span className={`news-item-category ${CAT_CLASSES[item.cat] || ''}`}>
              {item.cat.toUpperCase().slice(0, 3)}
            </span>
            <div style={{ flex: 1 }}>
              <div className="news-item-text">{item.text}</div>
              <div className="news-item-meta">
                @ {item.source}
                <span style={{ color: 'var(--text-dim)' }}>·</span>
                {item.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
