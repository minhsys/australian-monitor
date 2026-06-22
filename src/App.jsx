import { useState, useEffect, useRef } from 'react'
import Header       from './components/Header.jsx'
import LeftSidebar  from './components/LeftSidebar.jsx'
import MapCenter    from './components/MapCenter.jsx'
import RightSidebar from './components/RightSidebar.jsx'
import BottomTicker from './components/BottomTicker.jsx'

export default function App() {
  const [feedStats,  setFeedStats]  = useState({ total: 16, online: 12, totalFeeds: 400 })
  const [newsItems,  setNewsItems]  = useState([])
  const [financial,  setFinancial]  = useState(null)
  const [flights,    setFlights]    = useState([])
  const [ships,      setShips]      = useState({})
  const [seismic,    setSeismic]    = useState([])
  const [fires,      setFires]      = useState([])
  const [floods,     setFloods]     = useState([])
  const [weather,    setWeather]    = useState(null)
  const [fids,       setFids]       = useState({})
  const [aiBrief,    setAiBrief]    = useState(null)
  const [energy,     setEnergy]     = useState(null)
  const [absData,    setAbsData]    = useState(null)
  const [vitals,     setVitals]     = useState(null)
  const [threatIndex, setThreatIndex] = useState(null)
  const [roadClosures, setRoadClosures] = useState([])
  const wsRef = useRef(null)

  /* ── WebSocket connection for live data push ── */
  useEffect(() => {
    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${window.location.host}/ws`)

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'news')      setNewsItems(prev => [msg.payload, ...prev].slice(0, 200))
          if (msg.type === 'feedStats') setFeedStats(msg.payload)
          if (msg.type === 'financial') setFinancial(msg.payload)
          if (msg.type === 'flights')   setFlights(msg.payload)
          if (msg.type === 'seismic')   setSeismic(msg.payload)
          if (msg.type === 'fires')     setFires(msg.payload)
          if (msg.type === 'floods')    setFloods(msg.payload)
          if (msg.type === 'ships') {
            const ship = msg.payload
            setShips(prev => ({ ...prev, [ship.mmsi]: ship }))
          }
          if (msg.type === 'weather')  setWeather(msg.payload)
          if (msg.type === 'fids')     setFids(msg.payload)
          if (msg.type === 'ai_brief') setAiBrief(msg.payload)
          if (msg.type === 'energy')   setEnergy(msg.payload)
          if (msg.type === 'abs_data') setAbsData(msg.payload)
          if (msg.type === 'vitals')   setVitals(msg.payload)
          if (msg.type === 'news_batch') setNewsItems(msg.payload)
          if (msg.type === 'threat_index') setThreatIndex(msg.payload)
          if (msg.type === 'road_closures') setRoadClosures(msg.payload)
        } catch {}
      }

      ws.onclose = () => setTimeout(connect, 3000) // reconnect
      wsRef.current = ws
    }

    // Only connect if running against the real server (not pure Vite dev with no WS)
    if (import.meta.env.PROD || window.location.port === '3001') {
      connect()
    }

    return () => wsRef.current?.close()
  }, [])

  /* ── Poll REST API every 60s as fallback ── */
  useEffect(() => {
    const poll = async () => {
      try {
        const [newsRes, finRes, weatherRes, energyRes, absRes, vitalsRes, flightsRes, shipsRes, firesRes, floodsRes, seismicRes, threatRes, roadRes] = await Promise.allSettled([
          fetch('/api/news').then(r => r.json()),
          fetch('/api/financial').then(r => r.json()),
          fetch('/api/weather').then(r => r.json()),
          fetch('/api/energy').then(r => r.json()),
          fetch('/api/abs').then(r => r.json()),
          fetch('/api/vitals').then(r => r.json()),
          fetch('/api/flights').then(r => r.json()),
          fetch('/api/ships').then(r => r.json()),
          fetch('/api/fires').then(r => r.json()),
          fetch('/api/floods').then(r => r.json()),
          fetch('/api/seismic').then(r => r.json()),
          fetch('/api/threat-index').then(r => r.json()),
          fetch('/api/road-closures').then(r => r.json()),
        ])
        if (newsRes.status === 'fulfilled' && newsRes.value?.items) setNewsItems(newsRes.value.items)
        if (finRes.status === 'fulfilled') setFinancial(finRes.value)
        if (weatherRes.status === 'fulfilled' && Array.isArray(weatherRes.value)) setWeather(weatherRes.value)
        if (energyRes.status === 'fulfilled' && energyRes.value?.total_mw) setEnergy(energyRes.value)
        if (absRes.status === 'fulfilled' && absRes.value?.unemployment) setAbsData(absRes.value)
        if (vitalsRes.status === 'fulfilled' && vitalsRes.value?.airQuality) setVitals(vitalsRes.value)
        if (flightsRes.status === 'fulfilled' && Array.isArray(flightsRes.value)) setFlights(flightsRes.value)
        if (shipsRes.status === 'fulfilled' && Array.isArray(shipsRes.value)) {
          const shipMap = {}
          shipsRes.value.forEach(s => { shipMap[s.mmsi] = s })
          setShips(shipMap)
        }
        if (firesRes.status === 'fulfilled' && Array.isArray(firesRes.value)) setFires(firesRes.value)
        if (floodsRes.status === 'fulfilled' && Array.isArray(floodsRes.value)) setFloods(floodsRes.value)
        if (seismicRes.status === 'fulfilled' && Array.isArray(seismicRes.value)) setSeismic(seismicRes.value)
        if (threatRes.status === 'fulfilled' && threatRes.value) setThreatIndex(threatRes.value)
        if (roadRes.status === 'fulfilled' && Array.isArray(roadRes.value)) setRoadClosures(roadRes.value)
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
      <Header feedStats={feedStats} threatIndex={threatIndex} />

      <div className="body-grid">
        <LeftSidebar feedStats={feedStats} onForcePoll={handleForcePoll} weather={weather} />
        <MapCenter
          newsItems={newsItems}
          flights={flights}
          ships={Object.values(ships)}
          seismic={seismic}
          fires={fires}
          floods={floods}
          fids={fids}
          aiBrief={aiBrief}
          threatIndex={threatIndex}
          roadClosures={roadClosures}
        />
        <RightSidebar financial={financial} energy={energy} absData={absData} vitals={vitals} />
      </div>

      <BottomTicker financial={financial} newsItems={newsItems} />
    </div>
  )
}
