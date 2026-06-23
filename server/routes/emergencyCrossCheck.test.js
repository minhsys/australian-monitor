import { describe, expect, test } from 'vitest'
import { isComparableFeature, summarizeByAgency, compareState } from './emergencyCrossCheck.js'

const feature = agency => ({ properties: { source: { agency } } })

describe('isComparableFeature', () => {
  test('excludes pager dispatch logs', () => {
    expect(isComparableFeature(feature('SAAS-PAGER'))).toBe(false)
    expect(isComparableFeature(feature('CFS-PAGER'))).toBe(false)
  })

  test('excludes fire-danger-rating-only feeds', () => {
    expect(isComparableFeature(feature('CFA-FDR'))).toBe(false)
    expect(isComparableFeature(feature('ESA-FDR'))).toBe(false)
  })

  test('includes genuine incident feeds', () => {
    expect(isComparableFeature(feature('RFS'))).toBe(true)
    expect(isComparableFeature(feature('EMV'))).toBe(true)
    expect(isComparableFeature(feature('QFD-WARN'))).toBe(true)
  })
})

describe('summarizeByAgency', () => {
  test('counts features per agency tag', () => {
    const features = [feature('RFS'), feature('RFS'), feature('SES-PAGER')]
    expect(summarizeByAgency(features)).toEqual({ RFS: 2, 'SES-PAGER': 1 })
  })
})

describe('compareState', () => {
  test('excludes non-comparable agencies from the emergencyApiCount but keeps them in the breakdown', () => {
    const features = [feature('RFS'), feature('RFS'), feature('SES-PAGER')]
    const result = compareState('NSW', 2, features)
    expect(result.emergencyApiCount).toBe(2)
    expect(result.diff).toBe(0)
    expect(result.agencyBreakdown).toEqual({ RFS: 2, 'SES-PAGER': 1 })
  })

  test('reports a non-zero diff when counts diverge', () => {
    const features = [feature('RFS')]
    const result = compareState('NSW', 5, features)
    expect(result.diff).toBe(4)
  })
})
