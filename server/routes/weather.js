import fetch from 'node-fetch'

const POLL_MS = 15 * 60 * 1000

const CITIES = [
  { name: 'Sydney',    region: 'NSW', lat: -33.87, lon: 151.21 },
  { name: 'Melbourne', region: 'VIC', lat: -37.81, lon: 144.97 },
  { name: 'Brisbane',  region: 'QLD', lat: -27.47, lon: 153.02 },
  { name: 'Perth',     region: 'WA',  lat: -31.95, lon: 115.86 },
  { name: 'Adelaide',  region: 'SA',  lat: -34.93, lon: 138.60 },
  { name: 'Darwin',    region: 'NT',  lat: -12.46, lon: 130.84 },
  { name: 'Canberra',  region: 'ACT', lat: -35.28, lon: 149.13 },
  { name: 'Hobart',    region: 'TAS', lat: -42.88, lon: 147.33 },
]

function decodeWmo(code) {
  if (code === 0)  return { desc: 'Clear',         icon: '☀️' }
  if (code <= 2)   return { desc: 'Partly cloudy', icon: '⛅' }
  if (code === 3)  return { desc: 'Overcast',       icon: '☁️' }
  if (code <= 49)  return { desc: 'Foggy',          icon: '🌫' }
  if (code <= 57)  return { desc: 'Drizzle',        icon: '🌦' }
  if (code <= 67)  return { desc: 'Rain',           icon: '🌧' }
  if (code <= 77)  return { desc: 'Snow',           icon: '❄️' }
  if (code <= 82)  return { desc: 'Rain showers',   icon: '🌦' }
  if (code <= 86)  return { desc: 'Snow showers',   icon: '🌨' }
  if (code <= 99)  return { desc: 'Thunderstorm',   icon: '⛈' }
  return { desc: 'Unknown', icon: '🌡' }
}

async function fetchCity(city) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
    `&timezone=auto`

  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`)
  const data = await res.json()
  const cur  = data.current
  const { desc, icon } = decodeWmo(cur.weather_code ?? 0)

  return {
    name:     city.name,
    region:   city.region,
    temp:     Math.round(cur.temperature_2m ?? 0),
    desc,
    icon,
    humidity: Math.round(cur.relative_humidity_2m ?? 0),
    wind:     Math.round(cur.wind_speed_10m ?? 0),
  }
}

export async function fetchRealWeather() {
  const results = await Promise.allSettled(CITIES.map(fetchCity))
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    console.warn(`[WEATHER] ${CITIES[i].name} failed:`, r.reason.message)
    return null
  }).filter(Boolean)
}

export function startWeatherPoller(broadcast, store) {
  async function poll() {
    try {
      const weather = await fetchRealWeather()
      store.weather = weather
      broadcast('weather', weather)
      console.log(`[WEATHER] Updated ${weather.length}/8 cities`)
    } catch (err) {
      console.warn('[WEATHER] Poll failed:', err.message)
    }
  }

  poll()
  setInterval(poll, POLL_MS)
}
