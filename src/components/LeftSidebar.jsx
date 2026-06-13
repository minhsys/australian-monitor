import { useState, useEffect } from 'react'
import { RefreshCw, Cloud, Wind, Droplets, Thermometer } from 'lucide-react'

/* ── Mock weather data (replace with BOM API in Phase 3) ── */
const WEATHER_CITIES = [
  { name: 'Sydney',      region: 'NSW', temp: 22, desc: 'Partly cloudy', humidity: 62, wind: 15, icon: '⛅' },
  { name: 'Melbourne',   region: 'VIC', temp: 14, desc: 'Shower likely', humidity: 78, wind: 22, icon: '🌧' },
  { name: 'Brisbane',    region: 'QLD', temp: 28, desc: 'Sunny',         humidity: 55, wind: 12, icon: '☀️' },
  { name: 'Perth',       region: 'WA',  temp: 25, desc: 'Clear',         humidity: 48, wind: 18, icon: '🌤' },
  { name: 'Adelaide',    region: 'SA',  temp: 19, desc: 'Cloudy',        humidity: 70, wind: 20, icon: '☁️' },
  { name: 'Darwin',      region: 'NT',  temp: 33, desc: 'Humid/Hazy',   humidity: 82, wind: 9,  icon: '🌫' },
  { name: 'Canberra',    region: 'ACT', temp: 11, desc: 'Clear & cold',  humidity: 55, wind: 8,  icon: '🌙' },
  { name: 'Hobart',      region: 'TAS', temp: 8,  desc: 'Windy',        humidity: 85, wind: 35, icon: '💨' },
  { name: 'Cairns',      region: 'QLD', temp: 31, desc: 'Sunny',         humidity: 74, wind: 11, icon: '☀️' },
  { name: 'Townsville',  region: 'QLD', temp: 30, desc: 'Hot',           humidity: 68, wind: 14, icon: '🌡' },
  { name: 'Alice Spgs',  region: 'NT',  temp: 26, desc: 'Dust haze',     humidity: 18, wind: 28, icon: '🌪' },
  { name: 'Port Hedland',region: 'WA',  temp: 35, desc: 'Sunny/Hot',    humidity: 41, wind: 25, icon: '🔆' },
]

export default function LeftSidebar({ feedStats, onForcePoll }) {
  const [polling, setPolling] = useState(false)
  const [weather, setWeather] = useState(WEATHER_CITIES)

  const handleForcePoll = async () => {
    setPolling(true)
    onForcePoll?.()
    setTimeout(() => setPolling(false), 2000)
  }

  /* small random weather flicker (purely cosmetic, remove when BOM is wired) */
  useEffect(() => {
    const t = setInterval(() => {
      setWeather(prev =>
        prev.map(c => ({
          ...c,
          temp: c.temp + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0)
        }))
      )
    }, 30000)
    return () => clearInterval(t)
  }, [])

  return (
    <aside className="left-sidebar">
      {/* ── Monitor Control ── */}
      <div className="monitor-control">
        <div className="monitor-control-header">
          <span className="monitor-control-title">MONITOR<br />CONTROL</span>
          <div className="aggregator-status">
            <span className="dot" style={{ width: 6, height: 6, borderRadius: '50%',
              background: 'var(--accent-green)', boxShadow: '0 0 6px var(--accent-green)',
              display: 'inline-block' }} />
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

      {/* ── Weather Grid ── */}
      <div className="weather-section">
        <div className="weather-section-title">
          <Cloud size={10} />
          BOM Weather — Australia (Live)
        </div>

        <div className="weather-grid">
          {weather.map(city => (
            <div className="weather-city" key={city.name}>
              <div className="weather-city-header">
                <span className="weather-city-name">{city.name}</span>
                <span className="weather-city-region">{city.region}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 13 }}>{city.icon}</span>
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </aside>
  )
}
