# 🇦🇺 Australia Intelligence Monitor

Real-time Australian Geopolitical & Strategic Intelligence Dashboard.

Inspired by Vietnam Intelligence Monitor — rebuilt for Australia with Leaflet, Express, WebSocket, dual AI (GPT-4o + Gemini 2.5-flash), and Australian data sources.

---

## Quick Start (local dev)

```bash
git clone https://github.com/YOUR_USERNAME/australia-monitor.git
cd australia-monitor
npm install
cp .env.example .env
# Add your API keys to .env
npm run dev
# → React dev server: http://localhost:5173
# → Express API:      http://localhost:3001
```

## Production build

```bash
npm run build
npm start
# → http://localhost:3001
```

## Deploy to Render.com

1. Push repo to GitHub
2. New Web Service → Docker → connect repo
3. Add env vars from `.env.example`
4. Deploy — live URL in ~3 minutes

---

## Build Phases

| Phase | Status | Feature |
|-------|--------|---------|
| 1 | ✅ Done | Layout scaffold — Leaflet map, 3-column UI, mock data |
| 2 | 🔜 Next | Live map layers — OpenSky flights, AIS ships, Geoscience AU seismic, NASA FIRMS bushfire |
| 3 | 📋 Planned | Financial — Yahoo Finance, RBA XML, CoinGecko, NSW FuelCheck |
| 4 | 📋 Planned | Weather & FIDS — BOM API, AirLabs flight board, AEMO grid |
| 5 | 📋 Planned | AI News — GPT-4o + Gemini dual engine, RSS aggregator |
| 6 | 📋 Planned | Submarine cables, Finance map layer |
| 7 | 📋 Planned | Live TV panel + Webcam grid |
| 8 | 📋 Planned | Pacific intelligence module |

## Stack

- **Frontend**: React 18, Vite, Leaflet.js, Lucide Icons, Custom CSS
- **Backend**: Node.js, Express, WebSocket (ws)
- **AI**: GPT-4o + Gemini 2.5-flash (parallel race)
- **Deploy**: Docker → Render.com
