# 🇦🇺 Australia Intelligence Monitor

Real-time Australian geopolitical, infrastructure, and emergency intelligence dashboard. Live map layers, a composite national threat index, and an AI-generated news brief, all sourced from official and open data feeds — no mock data in production.

**Live demo:** https://australia-monitor-production.up.railway.app
<img width="2430" height="1286" alt="image" src="https://github.com/user-attachments/assets/293bcb65-6d35-4d26-ad4c-ad981d9cd980" />

---

## What it does

### Live map (MapLibre GL)
- **Flights** — live aircraft over Australian airspace (airplanes.live ADS-B feed)
- **Ships** — AIS vessel positions (AISStream)
- **Seismic** — recent earthquakes (Geoscience Australia)
- **Fires** — bushfire hotspots (NASA FIRMS)
- **Floods** — active flood warnings
- **Road closures** — live NSW hazards/closures (TfNSW Open Data Hub)
- **Emergency alerts** — incidents pulled directly from 7 state/territory agencies (RFS, CFA/EMV, QFES, CFS, DFES, TFS, ESA)
- **Submarine cables** — Australia's internet cable landing points (TeleGeography)

### Threat Level Index
A composite score (GREEN → RED) computed from live seismic, weather, fire, flood, energy, and cyber signals — with a stated driver (e.g. "RED — driver: energy") rather than an opaque number.

### Emergency impact estimation
For active emergency alerts, a deterministic estimate of affected area and population (distance-to-capital-city banding × severity-scaled radius), plus an AI-generated one-line infrastructure/traffic narrative for higher-severity incidents. Cross-checked against EmergencyAPI.com's aggregation as a sanity diagnostic.

### Financial & macro
ASX 200, AUD/USD, gold, BTC/ETH (Yahoo Finance, RBA exchange rate RSS, CoinGecko), AEMO live energy grid (renewable mix, NEM spot prices), AEMO/gas system energy outage notices, port congestion (derived from AIS idle/anchored vessel density near major seaports), and ABS national indicators (unemployment, CPI, population).

### Weather, vitals & travel
Open-Meteo weather for 8 capital cities, fire danger ratings, reservoir levels, Great Barrier Reef sea surface temperature, air quality (OpenAQ), and live flight departure boards (AirLabs FIDS) for major airports.

### AI news brief
RSS aggregation across 16 Australian news feeds, summarized by a Gemini → GPT-4o → OpenRouter fallback chain into a running intelligence brief.

---

## Quick start (local dev)

```bash
git clone https://github.com/minhsys/australian-monitor.git
cd australia-monitor
npm install
cp .env.example .env
# Add your API keys to .env — see .env.example for what each one unlocks
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

## Deploy

**Railway** (current host for the live demo):
```bash
railway login
railway init
railway up
railway domain
```
Set the API keys from `.env.example` as Railway service variables. The Dockerfile installs full deps, runs `vite build`, then prunes dev dependencies for the runtime image.

**Render.com** (`render.yaml` included):
1. Push repo to GitHub
2. New Web Service → Docker → connect repo
3. Add env vars from `.env.example`
4. Deploy

---

## Stack

- **Frontend**: React 19, Vite, MapLibre GL, Lucide Icons, custom CSS
- **Backend**: Node.js, Express, WebSocket (`ws`) for live push updates
- **AI**: Gemini 2.5-flash → GPT-4o → OpenRouter fallback chain
- **Testing**: Vitest
- **Deploy**: Docker → Railway / Render.com
