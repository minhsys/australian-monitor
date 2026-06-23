import { describe, expect, test } from 'vitest'
import { computeThreatIndex } from './threatIndex.js'

const baseAlert = (overrides) => ({
  id: 'a1', state: 'NSW', agency: 'RFS', category: 'fire', title: 'Test incident',
  status: 'Going', severity: 0, lat: -33, lon: 151, issued: null, url: null, ...overrides,
})

describe('computeThreatIndex — emergencyAlerts category', () => {
  test('is GREEN with no active alerts', () => {
    const { categories } = computeThreatIndex({ emergencyAlerts: [] })
    expect(categories.emergencyAlerts.level).toBe(0)
    expect(categories.emergencyAlerts.summary).toBe('No active state emergency-agency incidents')
  })

  test('escalates to level 1 for routine (ungraded) active incidents', () => {
    const { categories } = computeThreatIndex({ emergencyAlerts: [baseAlert()] })
    expect(categories.emergencyAlerts.level).toBe(1)
  })

  test('escalates to level 2 when a Watch and Act incident is active', () => {
    const { categories } = computeThreatIndex({ emergencyAlerts: [baseAlert({ severity: 2 })] })
    expect(categories.emergencyAlerts.level).toBe(2)
    expect(categories.emergencyAlerts.summary).toContain('1 Watch and Act')
  })

  test('escalates to level 3 when an Emergency Warning incident is active', () => {
    const { categories } = computeThreatIndex({ emergencyAlerts: [baseAlert({ severity: 3 })] })
    expect(categories.emergencyAlerts.level).toBe(3)
    expect(categories.emergencyAlerts.summary).toContain('1 Emergency Warning')
  })

  test('escalates to level 2 on incident-count volume alone, even with no graded warnings', () => {
    const alerts = Array.from({ length: 20 }, (_, i) => baseAlert({ id: `a${i}` }))
    const { categories } = computeThreatIndex({ emergencyAlerts: alerts })
    expect(categories.emergencyAlerts.level).toBe(2)
  })

  test('sorts sources by severity descending and caps at 5', () => {
    const alerts = [
      baseAlert({ id: 'low', severity: 0 }),
      baseAlert({ id: 'high', severity: 3 }),
      baseAlert({ id: 'mid', severity: 2 }),
    ]
    const { categories } = computeThreatIndex({ emergencyAlerts: alerts })
    expect(categories.emergencyAlerts.sources[0].id).toBe('high')
    expect(categories.emergencyAlerts.sources[1].id).toBe('mid')
  })

  test('the overall index can be driven by emergencyAlerts when it is the worst category', () => {
    // Emergency Warning caps at level 3 (ORANGE) — RED (4) is reserved for catastrophic/system-wide
    // events elsewhere in this file (M7+ earthquake, LOR3/market suspension), consistent with that scale.
    const { overall } = computeThreatIndex({ emergencyAlerts: [baseAlert({ severity: 3 })] })
    expect(overall.driver).toBe('emergencyAlerts')
    expect(overall.name).toBe('ORANGE')
  })
})

describe('computeThreatIndex — seismic category', () => {
  test('is GREEN with no recent earthquakes', () => {
    const { categories } = computeThreatIndex({ seismic: [] })
    expect(categories.seismic.level).toBe(0)
  })

  test('ignores earthquakes older than 24h', () => {
    const stale = { id: 'e1', magnitude: 7.5, place: 'Old quake', time: Date.now() - 25 * 60 * 60 * 1000 }
    const { categories } = computeThreatIndex({ seismic: [stale] })
    expect(categories.seismic.level).toBe(0)
  })

  test('escalates to RED (level 4) for a M7+ earthquake within 24h', () => {
    const big = { id: 'e1', magnitude: 7.2, place: 'Test Trench', time: Date.now() }
    const { categories } = computeThreatIndex({ seismic: [big] })
    expect(categories.seismic.level).toBe(4)
    expect(categories.seismic.summary).toContain('Test Trench')
  })

  test('uses the highest magnitude among multiple recent events', () => {
    const small = { id: 'e1', magnitude: 3.0, place: 'A', time: Date.now() }
    const big   = { id: 'e2', magnitude: 6.1, place: 'B', time: Date.now() }
    const { categories } = computeThreatIndex({ seismic: [small, big] })
    expect(categories.seismic.level).toBe(3)
  })
})

describe('computeThreatIndex — weather category', () => {
  test('is GREEN with no active warnings', () => {
    const { categories } = computeThreatIndex({ warnings: [] })
    expect(categories.weather.level).toBe(0)
  })

  test('ignores warnings that have already expired', () => {
    const expired = { id: 'w1', type: 'severe', expires: new Date(Date.now() - 1000).toISOString() }
    const { categories } = computeThreatIndex({ warnings: [expired] })
    expect(categories.weather.level).toBe(0)
  })

  test('escalates to level 3 for a severe/cyclone/tsunami warning', () => {
    const cyclone = { id: 'w1', type: 'cyclone', title: 'Cyclone warning' }
    const { categories } = computeThreatIndex({ warnings: [cyclone] })
    expect(categories.weather.level).toBe(3)
  })

  test('escalates to level 2 once 5 or more warnings are active, even if none are severe', () => {
    const warnings = Array.from({ length: 5 }, (_, i) => ({ id: `w${i}`, type: 'wind' }))
    const { categories } = computeThreatIndex({ warnings })
    expect(categories.weather.level).toBe(2)
  })
})

describe('computeThreatIndex — fire category', () => {
  test('is GREEN with no hotspots and no fire danger ratings', () => {
    const { categories } = computeThreatIndex({ fires: [] })
    expect(categories.fire.level).toBe(0)
  })

  test('escalates based on a catastrophic fire danger rating alone, with no hotspots', () => {
    const { categories } = computeThreatIndex({ fires: [], vitals: { fireDanger: { ratings: { NSW: 'catastrophic' } } } })
    expect(categories.fire.level).toBe(4)
    expect(categories.fire.summary).toContain('NSW')
  })

  test('escalates to level 3 for 50+ high-confidence hotspots', () => {
    const fires = Array.from({ length: 50 }, (_, i) => ({ lat: -30, lon: 145, confidence: 'h' }))
    const { categories } = computeThreatIndex({ fires })
    expect(categories.fire.level).toBe(3)
  })

  test('low-confidence hotspots do not count toward the hotspot threshold', () => {
    const fires = Array.from({ length: 50 }, () => ({ lat: -30, lon: 145, confidence: 'l' }))
    const { categories } = computeThreatIndex({ fires })
    expect(categories.fire.level).toBe(0)
  })
})

describe('computeThreatIndex — flood category', () => {
  test('is GREEN with no active flood warnings', () => {
    const { categories } = computeThreatIndex({ floods: [] })
    expect(categories.flood.level).toBe(0)
  })

  test('escalates to level 3 for a major/emergency severity flood', () => {
    const { categories } = computeThreatIndex({ floods: [{ id: 'f1', severity: 'major', title: 'Major flood' }] })
    expect(categories.flood.level).toBe(3)
  })
})

describe('computeThreatIndex — cyber category', () => {
  test('is GREEN with no recent cyber news', () => {
    const { categories } = computeThreatIndex({ news: [] })
    expect(categories.cyber.level).toBe(0)
  })

  test('escalates to level 3 for a critical-vulnerability/ransomware item', () => {
    const item = { id: 'n1', cat: 'cyber', timestamp: Date.now(), text: 'Active exploitation of critical vulnerability' }
    const { categories } = computeThreatIndex({ news: [item] })
    expect(categories.cyber.level).toBe(3)
  })

  test('ignores cyber news older than 24h', () => {
    const stale = { id: 'n1', cat: 'cyber', timestamp: Date.now() - 25 * 60 * 60 * 1000, text: 'old breach' }
    const { categories } = computeThreatIndex({ news: [stale] })
    expect(categories.cyber.level).toBe(0)
  })
})

describe('computeThreatIndex — infrastructure category', () => {
  test('is GREEN with no road closures or port congestion', () => {
    const { categories } = computeThreatIndex({ roadClosures: [], portCongestion: [] })
    expect(categories.infrastructure.level).toBe(0)
  })

  test('escalates to level 3 for 6+ active NSW road closures', () => {
    const closures = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, closure: true, title: 'Closure' }))
    const { categories } = computeThreatIndex({ roadClosures: closures, portCongestion: [] })
    expect(categories.infrastructure.level).toBe(3)
  })

  test('takes the worst of road and port levels, driven by port congestion', () => {
    const { categories } = computeThreatIndex({
      roadClosures: [],
      portCongestion: [{ name: 'Port X', level: 4, idleCount: 12 }],
    })
    expect(categories.infrastructure.level).toBe(4)
    expect(categories.infrastructure.summary).toContain('port(s) congested')
  })
})

describe('computeThreatIndex — energy category', () => {
  test('is GREEN with no electricity/gas notices and no fuel-shortage news', () => {
    const { categories } = computeThreatIndex({ energyOutages: { electricity: [], gas: [] }, news: [] })
    expect(categories.energy.level).toBe(0)
  })

  test('escalates to RED for an LOR3/market suspension electricity notice', () => {
    const notices = [{ id: 'e1', type: 'RESERVE NOTICE', label: 'LOR3 declared for SA Region' }]
    const { categories } = computeThreatIndex({ energyOutages: { electricity: notices, gas: [] }, news: [] })
    expect(categories.energy.level).toBe(4)
  })

  test('escalates on fuel-shortage news even with no AEMO notices', () => {
    const news = [{ id: 'n1', timestamp: Date.now(), text: 'Fuel shortage hits eastern states' }]
    const { categories } = computeThreatIndex({ energyOutages: { electricity: [], gas: [] }, news })
    expect(categories.energy.level).toBe(1)
  })
})

describe('computeThreatIndex — overall aggregation', () => {
  test('overall level is the max across all categories, GREEN when everything is empty', () => {
    const { overall } = computeThreatIndex({})
    expect(overall.name).toBe('GREEN')
    expect(overall.driver).toBeTruthy()
  })

  test('driver is whichever category currently holds the worst level', () => {
    const { overall } = computeThreatIndex({
      seismic: [{ id: 'e1', magnitude: 7.5, place: 'Test', time: Date.now() }],
      floods: [{ id: 'f1', severity: 'minor' }],
    })
    expect(overall.driver).toBe('seismic')
    expect(overall.name).toBe('RED')
  })
})
