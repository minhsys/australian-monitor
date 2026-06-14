import { useState, useEffect, useRef } from 'react'
import Header            from './components/Header.jsx'
import LeftSidebar       from './components/LeftSidebar.jsx'
import MapCenter         from './components/MapCenter.jsx'
import RightSidebar      from './components/RightSidebar.jsx'
import BottomTicker      from './components/BottomTicker.jsx'
import DashboardGrid     from './components/DashboardGrid.jsx'
import NewsPanel         from './components/panels/NewsPanel.jsx'
import StandaloneFids    from './components/panels/StandaloneFids.jsx'
import StandaloneSeismic from './components/panels/StandaloneSeismic.jsx'

export default function App() {
  const [feedStats,  setFeedStats]  = useState({ total: 16, online: 12, totalFeeds: 400 })
  const [newsItems,  setNewsItems]  = useState([])
  const [financial,  setFinancial]  = useState(null)
  const [flights,    setFlights]    = useState([])
  const [ships,      setShips]      = useState({})
  const [seismic,    setSeismic]    = useState([])
  const [fires,      setFires]      = useState([])
  const [weather,    setWeather]    = useState(null)
  const [fids,       setFids]       = useState({})
  const [aiBrief,    setAiBrief]    = useState(null)
  const wsRef = useRef(null)

  /* ── WebSocket connection for live data push ── */
  useEffect(() => {
    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${window.location.host}/ws`)

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'news')      setNewsItems(prev => [msg.payload, ...prev].slice(0, 50))
          if (msg.type === 'feedStats') setFeedStats(msg.payload)
          if (msg.type === 'financial') setFinancial(msg.payload)
          if (msg.type === 'flights')   setFlights(msg.payload)
          if (msg.type === 'seismic')   setSeismic(msg.payload)
          if (msg.type === 'fires')     setFires(msg.payload)
          if (msg.type === 'ships') {
            const ship = msg.payload
            setShips(prev => ({ ...prev, [ship.mmsi]: ship }))
          }
          if (msg.type === 'weather')  setWeather(msg.payload)
          if (msg.type === 'fids')     setFids(msg.payload)
          if (msg.type === 'ai_brief') setAiBrief(msg.payload)
          if (msg.type === 'news_batch') setNewsItems(msg.payload)
        } catch {}
      }

      ws.onclose = () => setTimeout(connect, 3000)
      ws.onerror = () => ws.close() // triggers onclose → retry
      wsRef.current = ws
    }

    connect()

    return () => wsRef.current?.close()
  }, [])

  /* ── Poll REST API every 60s as fallback ── */
  useEffect(() => {
    const poll = async () => {
      try {
        const [newsRes, finRes] = await Promise.allSettled([
          fetch('/api/news').then(r => r.json()),
          fetch('/api/financial').then(r => r.json()),
        ])
        if (newsRes.status === 'fulfilled' && newsRes.value?.items) {
          setNewsItems(newsRes.value.items)
        }
        if (finRes.status === 'fulfilled') {
          setFinancial(finRes.value)
        }
      } catch { /* server not up yet in pure client dev mode — use mock data */ }
    }

    poll()
    const t = setInterval(poll, 60_000)
    return () => clearInterval(t)
  }, [])

  const handleForcePoll = async () => {
    try { await fetch('/api/force-poll', { method: 'POST' }) } catch {}
  }

  return (
    <div className="app-shell">
      <Header feedStats={feedStats} />

      <DashboardGrid panels={{
        left:    <LeftSidebar feedStats={feedStats} onForcePoll={handleForcePoll} weather={weather} />,
        map:     <MapCenter newsItems={newsItems} flights={flights} ships={Object.values(ships)} seismic={seismic} fires={fires} fids={fids} aiBrief={aiBrief} />,
        right:   <RightSidebar financial={financial} />,
        news:    <NewsPanel newsItems={newsItems} aiBrief={aiBrief} />,
        fids:    <StandaloneFids fids={fids} />,
        seismic: <StandaloneSeismic seismic={seismic} />,
      }} />

      <BottomTicker financial={financial} newsItems={newsItems} />
    </div>
  )
}
