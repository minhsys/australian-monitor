import { describe, expect, test } from 'vitest'
import { estimateAreaImpact, computeAggregateImpact } from './emergencyImpact.js'

describe('estimateAreaImpact', () => {
  test('classifies a point right in Sydney as Major City', () => {
    const impact = estimateAreaImpact({ lat: -33.87, lon: 151.21, severity: 0 })
    expect(impact.remotenessClass).toBe('Major City')
  })

  test('classifies a point ~150km from the nearest capital as Outer Regional', () => {
    // Roughly Lithgow/Bathurst direction from Sydney
    const impact = estimateAreaImpact({ lat: -33.0, lon: 149.5, severity: 0 })
    expect(impact.remotenessClass).toBe('Outer Regional')
  })

  test('classifies a remote outback point as Remote', () => {
    const impact = estimateAreaImpact({ lat: -23.7, lon: 133.88, severity: 0 }) // Alice Springs area
    expect(impact.remotenessClass).toBe('Remote')
  })

  test('scales radius and area with severity', () => {
    const low  = estimateAreaImpact({ lat: -33.87, lon: 151.21, severity: 0 })
    const high = estimateAreaImpact({ lat: -33.87, lon: 151.21, severity: 3 })
    expect(high.radiusKm).toBeGreaterThan(low.radiusKm)
    expect(high.areaKm2).toBeGreaterThan(low.areaKm2)
  })

  test('higher density class produces a higher population estimate for the same radius', () => {
    const city   = estimateAreaImpact({ lat: -33.87, lon: 151.21, severity: 1 }) // Sydney CBD
    const remote = estimateAreaImpact({ lat: -23.7, lon: 133.88, severity: 1 })  // Outback
    expect(city.populationEstimate).toBeGreaterThan(remote.populationEstimate)
  })
})

describe('computeAggregateImpact', () => {
  test('returns zeroed aggregate for an empty incident list', () => {
    const aggregate = computeAggregateImpact([])
    expect(aggregate).toEqual({ totalPeopleEstimate: 0, totalAreaKm2: 0, incidentCount: 0 })
  })

  test('sums population and area estimates across all incidents', () => {
    const alerts = [
      { lat: -33.87, lon: 151.21, severity: 0 },
      { lat: -33.87, lon: 151.21, severity: 0 },
    ]
    const single    = estimateAreaImpact(alerts[0])
    const aggregate = computeAggregateImpact(alerts)
    expect(aggregate.incidentCount).toBe(2)
    expect(aggregate.totalAreaKm2).toBe(single.areaKm2 * 2)
    expect(aggregate.totalPeopleEstimate).toBe(single.populationEstimate * 2)
  })
})
