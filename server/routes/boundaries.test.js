import { describe, expect, test, vi, beforeEach } from 'vitest'
import fetch from 'node-fetch'
import { searchSA2ByName } from './boundaries.js'

vi.mock('node-fetch', () => ({ default: vi.fn() }))

const FC = { type: 'FeatureCollection', features: [
  { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] },
    properties: { sa2_code_2021: '101021007', sa2_name_2021: 'Sydney', state_code_2021: '1', area_albers_sqkm: 2.1 } },
] }

const jsonResponse = (body, ok = true, status = 200) => ({ ok, status, json: async () => body })
const decodeQuery = url => decodeURIComponent(url.replace(/\+/g, ' '))

describe('searchSA2ByName', () => {
  beforeEach(() => { vi.resetAllMocks() })

  test('queries the SA2 layer with a case-insensitive LIKE filter on the trimmed query', async () => {
    fetch.mockResolvedValue(jsonResponse(FC))
    await searchSA2ByName('  Sydney  ')
    const [url] = fetch.mock.calls[0]
    expect(url).toContain('/SA2/FeatureServer/1/query')
    expect(decodeQuery(url)).toContain("UPPER(sa2_name_2021) LIKE UPPER('%Sydney%')")
  })

  test('escapes single quotes in the query to prevent breaking out of the LIKE clause', async () => {
    fetch.mockResolvedValue(jsonResponse(FC))
    await searchSA2ByName("O'Connor")
    const [url] = fetch.mock.calls[0]
    expect(decodeQuery(url)).toContain("UPPER('%O''Connor%')")
  })

  test('caps the result count via resultRecordCount', async () => {
    fetch.mockResolvedValue(jsonResponse(FC))
    await searchSA2ByName('Spring')
    const [url] = fetch.mock.calls[0]
    expect(url).toContain('resultRecordCount=15')
  })

  test('returns the parsed geojson on success', async () => {
    fetch.mockResolvedValue(jsonResponse(FC))
    const result = await searchSA2ByName('Sydney')
    expect(result).toEqual(FC)
  })

  test('throws when the upstream request fails', async () => {
    fetch.mockResolvedValue(jsonResponse(null, false, 503))
    await expect(searchSA2ByName('Sydney')).rejects.toThrow('ABS boundary query HTTP 503')
  })

  test('throws when the upstream response carries an error payload', async () => {
    fetch.mockResolvedValue(jsonResponse({ error: { message: 'bad query' } }))
    await expect(searchSA2ByName('Sydney')).rejects.toThrow('bad query')
  })
})
