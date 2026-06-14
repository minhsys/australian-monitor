import WebSocket from 'ws'

const AIS_URL = 'wss://stream.aisstream.io/v0/stream'
const RECONNECT_MS = 10_000
const AU_BBOX = [[[-44, 112], [-10, 154]]]

function buildSubscription(apiKey) {
  return JSON.stringify({
    APIKey: apiKey,
    BoundingBoxes: AU_BBOX,
    FiltersShipMMSI: [],
    FilterMessageTypes: ['PositionReport'],
  })
}

function parseShip(msg) {
  const pos  = msg.Message?.PositionReport
  const meta = msg.MetaData
  if (!pos || pos.Latitude === 0 || pos.Longitude === 0) return null
  return {
    mmsi:    meta?.MMSI ?? 0,
    name:    (meta?.ShipName || 'Unknown').trim(),
    lat:     pos.Latitude,
    lon:     pos.Longitude,
    speed:   pos.Sog ?? 0,
    heading: pos.Cog ?? 0,
    status:  pos.NavigationalStatus ?? 0,
  }
}

export function startShipsWatcher(broadcast) {
  const key = process.env.AISSTREAM_KEY
  if (!key) {
    console.warn('[SHIPS] AISSTREAM_KEY not set — AIS layer disabled')
    return
  }

  function connect() {
    const ws = new WebSocket(AIS_URL)

    ws.on('open', () => {
      console.log('[SHIPS] AISStream connected')
      ws.send(buildSubscription(key))
    })

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.MessageType !== 'PositionReport') return
        const ship = parseShip(msg)
        if (ship) broadcast('ships', ship)
      } catch (err) {
        console.warn('[SHIPS] Parse error:', err.message)
      }
    })

    ws.on('close', () => {
      console.warn('[SHIPS] Disconnected — reconnecting in 10s')
      setTimeout(connect, RECONNECT_MS)
    })

    ws.on('error', (err) => console.warn('[SHIPS] WS error:', err.message))
  }

  connect()
}
