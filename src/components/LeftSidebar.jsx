import { useState, useEffect } from 'react'
import { RefreshCw, Cloud, Wind, Droplets, Tv, Plus } from 'lucide-react'

const PRESET_CHANNELS = [
  { id: 'au-live', name: 'ABC News Live',  url: 'https://www.youtube.com/embed/vOTiJkg1voo?autoplay=1&mute=1' },
  { id: 'sky-au',  name: 'Sky News',   url: 'https://www.youtube.com/embed/YDvsBbKfLPA?autoplay=1&mute=1' },
  { id: 'cnn',     name: 'CNN',      url: 'https://www.youtube.com/embed/GotlA1KKWoo?autoplay=1&mute=1' },
  { id: 'abc-au',  name: 'Al Jazeera', url: 'https://www.youtube.com/embed/gCNeDWCI0vo?autoplay=1&mute=1' },
]

function toEmbedUrl(raw) {
  if (!raw) return ''
  const m = raw.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ?? raw.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1` : raw.trim()
}

export default function LeftSidebar({ onForcePoll, weather: weatherProp }) {
  const [polling,    setPolling]    = useState(false)
  const [weather,    setWeather]    = useState(weatherProp ?? [])
  const [channels, setChannels] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('tv_channels'))
      if (!saved) return PRESET_CHANNELS
      // Ensure all URLs are muted
      return saved.map(ch => ({
        ...ch,
        url: ch.url.includes('mute=1') ? ch.url : ch.url.replace(/([?&]autoplay=1)/, '$1&mute=1'),
      }))
    } catch { return PRESET_CHANNELS }
  })
  const [activeId, setActiveId] = useState(
    () => localStorage.getItem('tv_active_id') ?? PRESET_CHANNELS[0].id
  )
  const [adding,   setAdding]   = useState(false)
  const [draft,    setDraft]    = useState({ name: '', url: '' })

  useEffect(() => {
    if (weatherProp) setWeather(weatherProp)
  }, [weatherProp])

  const handleForcePoll = async () => {
    setPolling(true)
    onForcePoll?.()
    setTimeout(() => setPolling(false), 2000)
  }

  const activeChannel = channels.find(c => c.id === activeId) ?? channels[0]

  const persistChannels = (next) => {
    setChannels(next)
    localStorage.setItem('tv_channels', JSON.stringify(next))
  }

  const selectChannel = (id) => {
    setActiveId(id)
    localStorage.setItem('tv_active_id', id)
  }

  const addChannel = () => {
    const url = toEmbedUrl(draft.url)
    if (!url) return
    const id   = `ch-${Date.now()}`
    const name = draft.name.trim() || 'Custom'
    const next = [...channels, { id, name, url }]
    persistChannels(next)
    selectChannel(id)
    setDraft({ name: '', url: '' })
    setAdding(false)
  }

  const removeChannel = (id) => {
    const next = channels.filter(c => c.id !== id)
    if (next.length === 0) return
    persistChannels(next)
    if (activeId === id) selectChannel(next[0].id)
  }

  return (
    <aside className="left-sidebar">
      {/* ── Monitor Control ── */}
      <div className="monitor-control">
        <div className="monitor-control-header">
          <span className="monitor-control-title">MONITOR<br />CONTROL</span>
          <div className="aggregator-status">
            <span className="dot" style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--accent-green)', boxShadow: '0 0 6px var(--accent-green)',
              display: 'inline-block',
            }} />
            AGGREGATOR LIVE
          </div>
        </div>

        <button className="force-poll-btn" onClick={handleForcePoll} disabled={polling}>
          <RefreshCw size={11} style={{ animation: polling ? 'spin 1s linear infinite' : 'none' }} />
          FORCE POLL
        </button>

      </div>

      {/* ── Weather Grid — 8 cities ── */}
      <div className="weather-section">
        <div className="weather-section-title">
          <Cloud size={10} />
          Live Weather — 8 Cities
        </div>
        <div className="weather-grid">
          {weather.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)', padding: '8px 0', letterSpacing: 1 }}>
              LOADING...
            </div>
          )}
          {weather.map(city => (
            <div className="weather-city" key={city.name}>
              <div className="weather-city-header">
                <span className="weather-city-name">{city.name}</span>
                <span className="weather-city-region">{city.region}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 11 }}>{city.icon}</span>
                <span className="weather-temp">{city.temp}°C</span>
              </div>
              <div className="weather-desc">{city.desc}</div>
              <div className="weather-extra">
                <span><Droplets size={7} /> {city.humidity}%</span>
                <span><Wind size={7} /> {city.wind}km/h</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TV Livestream ── */}
      <div className="tv-stream-section">
        <div className="tv-stream-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 2, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
            <Tv size={11} />
            TV LIVESTREAM
          </div>
          <button className="tv-config-btn" onClick={() => setAdding(prev => !prev)} title="Add channel">
            {adding ? '✕' : <Plus size={11} />}
          </button>
        </div>

        {/* Channel selector tabs */}
        <div className="tv-channel-tabs">
          {channels.map(ch => (
            <div key={ch.id} className="tv-tab-wrap">
              <button
                className={`tv-channel-tab${ch.id === activeId ? ' active' : ''}`}
                onClick={() => selectChannel(ch.id)}
              >
                {ch.name}
              </button>
              {channels.length > 1 && ch.id === activeId && (
                <button className="tv-channel-remove" onClick={() => removeChannel(ch.id)} title="Remove">×</button>
              )}
            </div>
          ))}
        </div>

        {/* Add channel form */}
        {adding && (
          <div className="tv-add-form">
            <input
              className="tv-url-input"
              value={draft.name}
              onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Name (e.g. Sky AU)"
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                className="tv-url-input"
                value={draft.url}
                onChange={e => setDraft(prev => ({ ...prev, url: e.target.value }))}
                placeholder="YouTube URL or embed URL"
                onKeyDown={e => e.key === 'Enter' && addChannel()}
                autoFocus
              />
              <button className="tv-url-save" onClick={addChannel}>ADD</button>
            </div>
          </div>
        )}

        <div className="tv-stream-frame">
          {activeChannel?.url ? (
            <iframe
              key={activeId}
              src={activeChannel.url}
              title={activeChannel.name}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div className="tv-placeholder">
              <Tv size={18} style={{ color: 'var(--text-dim)', marginBottom: 6 }} />
              <div style={{ color: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1.6 }}>
                NO STREAM<br />
                <span style={{ color: 'var(--accent-blue)' }}>Click + to add a channel</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </aside>
  )
}
