import { describe, expect, test, vi, beforeEach } from 'vitest'
import fetch from 'node-fetch'
import { fetchRealFinancial } from './financial.js'

vi.mock('node-fetch', () => ({ default: vi.fn() }))

const jsonResponse = (body, ok = true, status = 200) => ({
  ok, status, json: async () => body, text: async () => '',
})

const ASX_BODY    = { chart: { result: [{ meta: { regularMarketPrice: 8200, chartPreviousClose: 8150 } }] } }
const GOLD_BODY   = { chart: { result: [{ meta: { regularMarketPrice: 2650, chartPreviousClose: 2640 } }] } }
const CRYPTO_BODY = { bitcoin: { aud: 150000 }, ethereum: { aud: 8000 } }
const RBA_XML = `
  <item>United States dollar<rate><amount>0.6500</amount></item>
  <item>Japanese yen<rate><amount>95.20</amount></item>
`

function mockFetchByUrl({ asx = ASX_BODY, gold = GOLD_BODY, crypto = CRYPTO_BODY, rbaOk = true, asxOk = true, goldOk = true, cryptoOk = true } = {}) {
  fetch.mockImplementation(async (url) => {
    if (url.includes('AXJO'))      return jsonResponse(asx, asxOk)
    if (url.includes('GC%3DF'))    return jsonResponse(gold, goldOk)
    if (url.includes('coingecko')) return jsonResponse(crypto, cryptoOk)
    if (url.includes('rba.gov.au')) return { ok: rbaOk, status: rbaOk ? 200 : 500, text: async () => RBA_XML }
    throw new Error(`Unexpected URL in test: ${url}`)
  })
}

describe('fetchRealFinancial', () => {
  beforeEach(() => { vi.resetAllMocks() })

  test('builds a full result from successful upstream responses, with no prior state', async () => {
    mockFetchByUrl()
    const result = await fetchRealFinancial(null)
    expect(result.asx200).toEqual({ value: 8200, change: 50, changePct: 0.61 })
    expect(result.crypto.btc).toBe(150000)
    expect(result.crypto.eth).toBe(8000)
    expect(result.audusd.value).toBe(0.65)
  })

  test('does not crash when called with no prior state and every upstream fetch fails', async () => {
    fetch.mockRejectedValue(new Error('network down'))
    const result = await fetchRealFinancial(null)
    expect(result.asx200).toBeNull()
    expect(result.gold).toBeNull()
    expect(result.audusd.value).toBe(0.6471) // documented hardcoded fallback
    expect(result.crypto).toEqual({ btc: 0, eth: 0, btcChange: 0, ethChange: 0 })
  })

  test('falls back to the previous state per-field when only some upstream fetches fail', async () => {
    const current = {
      asx200: { value: 8000, change: 10, changePct: 0.1 },
      gold: { value: 4000, change: 5 },
      audusd: { value: 0.64, change: 0.001 },
      crypto: { btc: 90000, eth: 5000, btcChange: 1, ethChange: -1 },
    }
    mockFetchByUrl({ asxOk: false, goldOk: false, cryptoOk: false, rbaOk: false })
    const result = await fetchRealFinancial(current)
    expect(result.asx200).toEqual(current.asx200)
    expect(result.gold).toEqual(current.gold)
    expect(result.crypto.btc).toBe(90000)
    expect(result.crypto.eth).toBe(5000)
  })

  test('a malformed (missing price) ASX response is treated as a failure, not a crash', async () => {
    mockFetchByUrl({ asx: { chart: { result: [{ meta: {} }] } } })
    const result = await fetchRealFinancial({ asx200: { value: 7000, change: 0, changePct: 0 } })
    expect(result.asx200).toEqual({ value: 7000, change: 0, changePct: 0 })
  })

  test('converts gold to AUD using the previous cycle\'s rate, since gold and rates fetch in parallel', async () => {
    mockFetchByUrl()
    // fetchGold(prevRate) is launched in the same Promise.allSettled as fetchRates(), so it can't
    // see this cycle's freshly fetched rate yet — it uses current.audusd.value, falling back to
    // the hardcoded 0.6471 when there's no prior state (as here, current = null).
    const result = await fetchRealFinancial(null)
    expect(result.gold.value).toBe(Math.round(2650 / 0.6471))
    expect(result.gold.value_usd).toBe(2650)
  })

  test('converts gold to AUD using the prior state\'s AUD/USD rate when one exists', async () => {
    mockFetchByUrl()
    const result = await fetchRealFinancial({ audusd: { value: 0.70 } })
    expect(result.gold.value).toBe(Math.round(2650 / 0.70))
  })
})
