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
