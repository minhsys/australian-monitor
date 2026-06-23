# 🇦🇺 Australia Intelligence Monitor

Real-time Australian Geopolitical & Strategic Intelligence Dashboard.

 Australia with Leaflet, Express, WebSocket, dual AI ( Gemini 2.5-flash), and Australian data sources.

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
| 2 | ✅ Done | Live map layers — OpenSky flights, AIS ships, Geoscience AU seismic, NASA FIRMS bushfire |
| 3 | ✅ Done | Financial — Yahoo Finance, RBA XML, CoinGecko, NSW FuelCheck |
| 4 | ✅ Done | Weather & FIDS — Open-Meteo, AirLabs flight board |
| 5 | ✅ Done | AI News — GPT-4o + Gemini dual engine, RSS aggregator (16 feeds) |
| 6 | ✅ Done | AEMO live energy grid — renewable % donut, fuel mix bars, NEM spot prices |
| 7 | ✅ Done | Australian vitals — fire danger ratings, reservoir levels, GBR SST, air quality (OpenAQ) |
| 8 | 📋 Planned | Pacific intelligence module |

## Stack

- **Frontend**: React 18, Vite, Leaflet.js, Lucide Icons, Custom CSS
- **Backend**: Node.js, Express, WebSocket (ws)
- **AI**: GPT-4o + Gemini 2.5-flash (parallel race)
- **Deploy**: Docker → Render.com
