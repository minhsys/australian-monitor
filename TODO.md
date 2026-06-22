# TODO / Action Items

Living tracker — updated whenever there's something you need to action, or something I need to remember for next session. Not a changelog; see `git log` for history.

_Last updated: 2026-06-23_

## 🟢 In progress — pick up next session

_(nothing in progress right now — see backlog below)_

---

## 🔴 Needs your action

- [ ] **Register a free TfNSW Open Data Hub API key** and set `TRANSPORT_NSW_KEY` in `.env`.
  Sign up at https://opendata.transport.nsw.gov.au → My Account → Applications → create one → API Management → add "Live Traffic Hazards" → copy the key.
  Without this, the Road Closures map layer stays empty (fails silently, just logs a warning server-side).
- [ ] **Rotate your OpenRouter API key.** It was pasted in plaintext in this chat early in the session (low risk — free tier, no billing exposure — but still sitting in conversation history). Regenerate in the OpenRouter dashboard and update `OPENROUTER_KEY` in `.env`.

## 🟡 Known gaps, not urgent

- [ ] `GPT4O_KEY`, `FR24_API_KEY`, `ACLED_KEY` are empty in `.env` — pre-existing, app runs fine without them (Gemini/OpenRouter cover AI brief, OpenSky covers flights). Only fill these in if you want those specific providers active.
- [ ] Reservoir/dam storage levels remain **static placeholder data** (not live) — no public API exists for this (see session notes below). Revisit only if WaterNSW/Seqwater/Melbourne Water offer direct API access in future.

## 🔵 Build backlog (Dashboard 2.0, prioritized)

From the pillar review — ✅ done, ⬜ not started:

- ✅ **Threat Level Index (Pillar 4)** — composite score from seismic/weather/fire/flood/cyber, with drilldown.
- ✅ **Road closures (Pillar 1)** — TfNSW Live Traffic Hazards, map layer + popups (pending your API key).
- ⬜ **Reservoir levels (Pillar 1)** — skipped, no reliable public API found.
- ✅ **Port congestion metric (Pillar 1)** — `server/routes/portCongestion.js` derives idle/anchored vessel counts (AIS status 1/5) within 20km of each of the 11 major seaports from existing AIS ship data, polled every 60s.
- ✅ **Fold infrastructure into Threat Index** — `threatIndex.js` now has a 6th `infrastructure` category combining road closures + port congestion, exposed via `/api/threat-index` and the map's Early Warning panel.
- ⬜ **Grid instability proxy (Pillar 4)** — AEMO spot-price spike as a substitute signal for grid frequency (which isn't public); reuses existing `energy.js` data.
- ⬜ **Sentiment/misinformation tracking (Pillar 3, scoped)** — Reddit + Google Trends (skip X/Twitter, now paid); reuse existing Gemini/OpenRouter pipeline for classification.
- ❌ **Public Health & Humanitarian (Pillar 2)** — dropped; no public data source exists in Australia for any of its KPIs.

## 📝 Session notes / decisions worth remembering

- This app is 100% public-data OSINT — no SCADA/utility/telco/911 internal access. Anything modeled on internal Emergency Operations Center data (Pillar 2 in full) is a non-starter.
- WaterNSW dam-levels page has no exposed API (server-rendered HTML only) — don't revisit scraping it without a structural change on their end.
- BOM's official water data API (SOS2/XML) is explicitly "not near-real-time" and complex — same reason fire-danger ratings already fall back to a seasonal guess.
- Port congestion thresholds (`portCongestion.js`) are first-pass guesses, not calibrated against real port traffic: 20km radius, level escalates at 1/3/6/10 idle (anchored/moored) vessels. Revisit if congestion levels look obviously wrong once live AIS data is observed over a few days — e.g. some bulk ports (Port Hedland, Hay Point) routinely queue more ships than container ports, so a flat threshold may need to be per-port.
