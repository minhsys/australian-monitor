import { describe, expect, test } from 'vitest'
import { computePortCongestion } from './portCongestion.js'

const PORT_BOTANY = { lat: -33.97, lon: 151.20 }

const ship = (overrides) => ({
  mmsi: 1, lat: PORT_BOTANY.lat, lon: PORT_BOTANY.lon, status: 1, ...overrides,
})

describe('computePortCongestion', () => {
  test('returns level 0 for every port when there are no ships', () => {
    const result = computePortCongestion([])
    expect(result).toHaveLength(11)
    expect(result.every(p => p.level === 0 && p.idleCount === 0 && p.nearbyCount === 0)).toBe(true)
  })

  test('ignores ships outside the 20km port radius', () => {
    const farShip = ship({ lat: -10, lon: 130 }) // nowhere near Port Botany
    const result = computePortCongestion([farShip])
    const botany = result.find(p => p.name === 'Port Botany (Sydney)')
    expect(botany.nearbyCount).toBe(0)
  })

  test('counts a nearby ship even if it is not idle (status 0 = underway)', () => {
    const underway = ship({ status: 0 })
    const result = computePortCongestion([underway])
    const botany = result.find(p => p.name === 'Port Botany (Sydney)')
    expect(botany.nearbyCount).toBe(1)
    expect(botany.idleCount).toBe(0)
    expect(botany.level).toBe(0)
  })

  test('counts status 1 (at anchor) and status 5 (moored) as idle', () => {
    const anchored = ship({ mmsi: 1, status: 1 })
    const moored   = ship({ mmsi: 2, status: 5 })
    const result = computePortCongestion([anchored, moored])
    const botany = result.find(p => p.name === 'Port Botany (Sydney)')
    expect(botany.idleCount).toBe(2)
  })

  test.each([
    [0, 0], [1, 1], [2, 1], [3, 2], [5, 2], [6, 3], [9, 3], [10, 4], [15, 4],
  ])('idleCount=%i maps to congestion level=%i', (idleCount, expectedLevel) => {
    const ships = Array.from({ length: idleCount }, (_, i) => ship({ mmsi: i, status: 1 }))
    const result = computePortCongestion(ships)
    const botany = result.find(p => p.name === 'Port Botany (Sydney)')
    expect(botany.level).toBe(expectedLevel)
  })

  test('accepts ships as an object map (keyed by mmsi) as well as an array', () => {
    const shipsMap = { 123: ship({ mmsi: 123, status: 1 }) }
    const result = computePortCongestion(shipsMap)
    const botany = result.find(p => p.name === 'Port Botany (Sydney)')
    expect(botany.idleCount).toBe(1)
  })

  test('treats null/undefined ships as no ships, not a crash', () => {
    expect(() => computePortCongestion(undefined)).not.toThrow()
    const result = computePortCongestion(undefined)
    expect(result.every(p => p.idleCount === 0)).toBe(true)
  })

  test('a ship near one port does not affect a different port', () => {
    const nearBotany = ship({ status: 1 })
    const result = computePortCongestion([nearBotany])
    const melbourne = result.find(p => p.name === 'Port of Melbourne')
    expect(melbourne.idleCount).toBe(0)
    expect(melbourne.level).toBe(0)
  })
})
