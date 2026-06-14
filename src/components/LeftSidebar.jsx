import { useState, useEffect } from 'react'
import { RefreshCw, Cloud, Wind, Droplets, Tv } from 'lucide-react'

const WEATHER_CITIES = [
  { name: 'Sydney',    region: 'NSW', temp: 22, desc: 'Partly cloudy', humidity: 62, wind: 15, icon: '⛅' },
  { name: 'Melbourne', region: 'VIC', temp: 14, desc: 'Shower likely', humidity: 78, wind: 22, icon: '🌧' },
  { name: 'Brisbane',  region: 'QLD', temp: 28, desc: 'Sunny',         humidity: 55, wind: 12, icon: '☀️' },
  { name: 'Perth',     region: 'WA',  temp: 25, desc: 'Clear',         humidity: 48, wind: 18, icon: '🌤' },
  { name: 'Adelaide',  region: 'SA',  temp: 19, desc: 'Cloudy',        humidity: 70, wind: 20, icon: '☁️' },
  { name: 'Darwin',    region: 'NT',  temp: 33, desc: 'Humid/Hazy',   humidity: 82, wind: 9,  icon: '🌫' },
  { name: 'Canberra',  region: 'ACT', temp: 11, desc: 'Clear & cold',  humidity: 55, wind: 8,  icon: '🌙' },
  { name: 'Hobart',    region: 'TAS', temp: 8,  desc: 'Windy',        humidity: 85, wind: 35, icon: '💨' },
]

export default function LeftSidebar({ feedStats, onForcePoll, weather: weatherProp }) {
  const [polling,    setPolling]    = useState(false)
  const [weather,    setWeather]    = useState(weatherProp || WEATHER_CITIES)
  const [streamUrl,  setStreamUrl]  = useState(
    () => localStorage.getItem('tv_stream_url') || ''
  )
  const [editingUrl, setEditingUrl] = useState(false)
  const [urlDraft,   setUrlDraft]   = useState('')

  useEffect(() => {
    if (weatherProp) setWeather(weatherProp)
  }, [weatherProp])

  /* cosmetic flicker until real weather is wired */
  useEffect(() => {
    if (weatherProp) return
    const t = setInterval(() => {
      setWeather(prev =>
        prev.map(c => ({
          ...c,
          temp: c.temp + (Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0),
        }))
      )
    }, 30_000)
    return () => clearInterval(t)
  }, [weatherProp])

  const handleForcePoll = async () => {
    setPolling(true)
    onForcePoll?.()
    setTimeout(() => setPolling(false), 2000)
  }

  const openUrlEditor = () => {
    setUrlDraft(streamUrl)
    setEditingUrl(true)
  }

  const saveStreamUrl = () => {
    const url = urlDraft.trim()
    setStreamUrl(url)
    localStorage.setItem('tv_stream_url', url)
    setEditingUrl(false)
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

        <div className="feed-stats">
          <div className="feed-stat-card">
            <div className="feed-stat-value">{feedStats?.totalFeeds ?? 400}</div>
            <div className="feed-stat-label">Total Feeds</div>
          </div>
          <div className="feed-stat-card sources">
            <div className="feed-stat-value">
              {feedStats?.online ?? 12}/{feedStats?.total ?? 16}
            </div>
            <div className="feed-stat-label">Sources Online</div>
          </div>
        </div>
      </div>

      {/* ── Weather Grid — 8 cities ── */}
      <div className="weather-section">
        <div className="weather-section-title">
          <Cloud size={10} />
          BOM Weather — 8 Cities
        </div>
        <div className="weather-grid">
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
            <Tv size={10} />
            TV LIVESTREAM
          </div>
          <button className="tv-config-btn" onClick={editingUrl ? () => setEditingUrl(false) : openUrlEditor}>
            {editingUrl ? '✕' : '⚙'}
          </button>
        </div>

        {editingUrl && (
          <div className="tv-url-editor">
            <input
              className="tv-url-input"
              value={urlDraft}
              onChange={e => setUrlDraft(e.target.value)}
              placeholder="YouTube embed URL…"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveStreamUrl()}
            />
            <button className="tv-url-save" onClick={saveStreamUrl}>SET</button>
          </div>
        )}

        <div className="tv-stream-frame">
          {streamUrl ? (
            <iframe
              src={streamUrl}
              title="TV Livestream"
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div className="tv-placeholder">
              <Tv size={18} style={{ color: 'var(--text-dim)', marginBottom: 6 }} />
              <div style={{ color: 'var(--text-dim)', fontSize: 9, fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1.6 }}>
                NO STREAM CONFIGURED<br />
                <span style={{ color: 'var(--accent-blue)' }}>Click ⚙ to set embed URL</span><br />
                <span style={{ color: 'var(--text-dim)', fontSize: 8 }}>e.g. YouTube embed src</span>
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
