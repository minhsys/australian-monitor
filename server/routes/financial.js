import fetch from 'node-fetch'

const POLL_MS = 3 * 60 * 1000

const YAHOO_AXJO = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EAXJO?interval=1d&range=1d'
const YAHOO_GOLD = 'https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=1d'
const RBA_RSS    = 'https://www.rba.gov.au/rss/rss-cb-exchange-rates.xml'
const COINGECKO  = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=aud'

async function fetchASX200() {
  const res = await fetch(YAHOO_AXJO, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AustraliaMonitor/1.0)' },
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`)
  const data = await res.json()
  const meta = data.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) throw new Error('No ASX price in response')
  const value     = meta.regularMarketPrice
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? value
  return {
    value:     +value.toFixed(2),
    change:    +(value - prevClose).toFixed(2),
    changePct: +((value - prevClose) / prevClose * 100).toFixed(2),
  }
}

async function fetchGold(audUsdRate) {
  const res = await fetch(YAHOO_GOLD, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AustraliaMonitor/1.0)' },
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) throw new Error(`Yahoo Gold HTTP ${res.status}`)
  const data = await res.json()
  const meta = data.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) throw new Error('No gold price in response')
  const usd     = meta.regularMarketPrice
  const usdPrev = meta.chartPreviousClose ?? usd
  const rate    = audUsdRate ?? 0.6471
  return {
    value:     +Math.round(usd / rate),
    value_usd: +usd.toFixed(2),
    change:    +Math.round((usd - usdPrev) / rate),
  }
}

async function fetchRates() {
  const res = await fetch(RBA_RSS, { signal: AbortSignal.timeout(8_000) })
  if (!res.ok) throw new Error(`RBA RSS HTTP ${res.status}`)
  const xml = await res.text()

  function extractRate(phrase) {
    const re = new RegExp(phrase + '[\\s\\S]*?<[^>]+>([0-9]+\\.[0-9]+)', 'i')
    const m  = xml.match(re)
    return m ? parseFloat(m[1]) : null
  }

  return {
    audusd: extractRate('United States dollar'),
    audjpy: extractRate('Japanese yen'),
    audcny: extractRate('Chinese renminbi'),
  }
}

async function fetchCrypto() {
  const res = await fetch(COINGECKO, { signal: AbortSignal.timeout(8_000) })
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
  const data = await res.json()
  return {
    btc: data.bitcoin?.aud ?? null,
    eth: data.ethereum?.aud ?? null,
  }
}

export async function fetchRealFinancial(current) {
  const prevRate = current?.audusd?.value ?? 0.6471
  const [asxRes, ratesRes, cryptoRes, goldRes] = await Promise.allSettled([
    fetchASX200(),
    fetchRates(),
    fetchCrypto(),
    fetchGold(prevRate),
  ])

  if (asxRes.status    === 'rejected') console.warn('[FIN] ASX200:', asxRes.reason.message)
  if (ratesRes.status  === 'rejected') console.warn('[FIN] RBA rates:', ratesRes.reason.message)
  if (cryptoRes.status === 'rejected') console.warn('[FIN] Crypto:', cryptoRes.reason.message)
  if (goldRes.status   === 'rejected') console.warn('[FIN] Gold:', goldRes.reason.message)

  const asx200 = asxRes.status   === 'fulfilled' ? asxRes.value    : current?.asx200 ?? null
  const rates  = ratesRes.status === 'fulfilled' ? ratesRes.value  : {}
  const crypto = cryptoRes.status === 'fulfilled' ? cryptoRes.value : {}
  const gold   = goldRes.status  === 'fulfilled' ? goldRes.value   : current?.gold ?? null

  const prevUsd = current?.audusd?.value ?? null
  const newUsd  = rates.audusd ?? prevUsd

  return {
    ...(current ?? {}),
    asx200,
    audusd: {
      value:  newUsd ?? 0.6471,
      change: newUsd && prevUsd ? +(newUsd - prevUsd).toFixed(4) : current?.audusd?.change ?? -0.0018,
    },
    gold,
    audjpy: rates.audjpy ?? current?.audjpy ?? null,
    audcny: rates.audcny ?? current?.audcny ?? null,
    crypto: {
      btc:       crypto.btc ?? current?.crypto?.btc ?? 0,
      eth:       crypto.eth ?? current?.crypto?.eth ?? 0,
      btcChange: current?.crypto?.btcChange ?? 0,
      ethChange: current?.crypto?.ethChange ?? 0,
    },
  }
}

export function startFinancialPoller(broadcast, store) {
  async function poll() {
    try {
      const updated = await fetchRealFinancial(store.financial)
      store.financial = { ...updated, updatedAt: new Date().toISOString() }
      broadcast('financial', store.financial)
      console.log(`[FIN] ASX ${store.financial.asx200?.value} · AUD/USD ${store.financial.audusd?.value}`)
    } catch (err) {
      console.warn('[FIN] Poll failed:', err.message)
    }
  }

  poll()
  setInterval(poll, POLL_MS)
}
