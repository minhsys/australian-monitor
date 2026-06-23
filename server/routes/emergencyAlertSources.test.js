import { describe, expect, test } from 'vitest'
import {
  normalizeSeverity,
  normalizeCategory,
  parseNswRfs,
  parseVicEmergency,
  parseQldQfes,
  parseSaCfs,
  parseWaItems,
  parseTasTfs,
  parseActEsa,
} from './emergencyAlertSources.js'

describe('normalizeSeverity', () => {
  test('maps Emergency Warning to 3', () => {
    expect(normalizeSeverity('Bushfire Emergency Warning')).toBe(3)
  })

  test('maps Watch and Act to 2', () => {
    expect(normalizeSeverity('Watch and Act')).toBe(2)
  })

  test('maps Advice to 1', () => {
    expect(normalizeSeverity('Bushfire Advice MONITOR CONDITIONS')).toBe(1)
  })

  test('returns 0 for routine/informational text', () => {
    expect(normalizeSeverity('Information')).toBe(0)
    expect(normalizeSeverity('Planned Burn')).toBe(0)
    expect(normalizeSeverity('')).toBe(0)
  })
})

describe('normalizeCategory', () => {
  test('classifies fire-related text', () => {
    expect(normalizeCategory('BUSHFIRE')).toBe('fire')
    expect(normalizeCategory('Vehicle Fire')).toBe('fire')
    expect(normalizeCategory('Burn Off')).toBe('fire')
    expect(normalizeCategory('Hazard Reduction')).toBe('fire')
  })

  test('classifies flood, storm, hazmat, medical text', () => {
    expect(normalizeCategory('Flood Watch')).toBe('flood')
    expect(normalizeCategory('Severe Tropical Cyclone')).toBe('storm')
    expect(normalizeCategory('ELECTRICAL THREAT OR POWER LINES DOWN')).toBe('hazmat')
    expect(normalizeCategory('AMBULANCE RESPONSE')).toBe('medical')
  })

  test('falls back to other when nothing matches', () => {
    expect(normalizeCategory('Vehicle Accident')).toBe('other')
    expect(normalizeCategory()).toBe('other')
  })
})

describe('parseNswRfs', () => {
  const fixture = {
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [151.65, -29.32] },
          { type: 'Polygon', coordinates: [[[151.0, -29.0], [151.1, -29.1], [151.0, -29.0]]] },
        ],
      },
      properties: {
        title: 'Bridge Creek HR',
        link: 'https://www.rfs.nsw.gov.au/fire-information/fires-near-me',
        category: 'Planned Burn',
        guid: 'https://incidents.rfs.nsw.gov.au/api/v1/incidents/663388',
        pubDate: '23/06/2026 12:30:00 AM',
        description: 'ALERT LEVEL: Planned Burn <br />LOCATION: TORRINGTON <br />STATUS: Under control <br />TYPE: Hazard Reduction <br />',
      },
    }],
  }

  test('extracts the Point from a GeometryCollection, ignoring the perimeter Polygon', () => {
    const [incident] = parseNswRfs(fixture)
    expect(incident.lat).toBeCloseTo(-29.32)
    expect(incident.lon).toBeCloseTo(151.65)
  })

  test('parses fields out of the HTML description text', () => {
    const [incident] = parseNswRfs(fixture)
    expect(incident.status).toBe('Under control')
    expect(incident.severity).toBe(0) // "Planned Burn" alert level is not a graded warning
    expect(incident.category).toBe('fire')
    expect(incident.state).toBe('NSW')
    expect(incident.agency).toBe('RFS')
  })

  test('drops features with no resolvable point geometry', () => {
    const noPoint = { features: [{ properties: {}, geometry: { type: 'Polygon', coordinates: [] } }] }
    expect(parseNswRfs(noPoint)).toHaveLength(0)
  })
})

describe('parseVicEmergency', () => {
  const fixture = {
    results: [
      {
        incidentNo: 247688, name: 'TEST PROD RECORD - DO NOT DELE', incidentType: 'BUSHFIRE',
        incidentLocation: '5KM SW OF BOROUGH HUTS', incidentStatus: 'Not Yet Under Control',
        agency: 'DELWP', latitude: -37.25, longitude: 142.4935, originDateTime: '01/12/2025 16:55:00',
      },
      {
        incidentNo: 282493, name: '', incidentType: 'OTHER', incidentLocation: 'SWAN HILL',
        incidentStatus: 'Under Control', agency: 'CFA', category1: 'Other', category2: 'Other',
        latitude: -35.35, longitude: 143.56, originDateTime: '23/06/2026 10:40:00',
      },
    ],
  }

  test('filters out the permanent "TEST PROD RECORD" fixture VicEmergency publishes', () => {
    const incidents = parseVicEmergency(fixture)
    expect(incidents).toHaveLength(1)
    expect(incidents[0].id).toBe('vic-282493')
  })

  test('falls back to incidentLocation when name is blank, and classifies category', () => {
    const [incident] = parseVicEmergency(fixture)
    expect(incident.title).toBe('SWAN HILL')
    expect(incident.agency).toBe('CFA')
    expect(incident.category).toBe('other')
  })
})

describe('parseQldQfes', () => {
  const fixture = {
    features: [{
      geometry: { type: 'Point', coordinates: [16039136.76, -1662224.58] },
      properties: {
        UniqueID: 'QF7-26-062341', WarningTitle: 'Information - LAKEFIELD', WarningLevel: 'Watch and Act',
        WarningArea: 'LAKEFIELD', CurrentStatus: 'Going', Latitude: -14.765804, Longitude: 144.082017,
        GroupedType: 'FIRE PERMITTED BURN', EventType: 'Fire', ItemDateTimeLocal_ISO: '2026-05-19T02:46:04+10:00',
      },
    }],
  }

  test('uses the WGS84 Latitude/Longitude properties, not the EPSG:3857 geometry', () => {
    const [incident] = parseQldQfes(fixture)
    expect(incident.lat).toBeCloseTo(-14.765804)
    expect(incident.lon).toBeCloseTo(144.082017)
  })

  test('reads severity from WarningLevel and category from GroupedType', () => {
    const [incident] = parseQldQfes(fixture)
    expect(incident.severity).toBe(2)
    expect(incident.category).toBe('fire')
    expect(incident.state).toBe('QLD')
  })
})

describe('parseSaCfs', () => {
  const fixture = [{
    IncidentNo: '1710603', Date: '23/06/2026', Time: '10:12', Location_name: 'HAMLEY BRIDGE, MALCOLM STREET',
    Type: 'Building Fire', Status: 'GOING', Location: '-34.3600481340743,138.687870609206',
  }]

  test('splits the combined Location string into lat/lon', () => {
    const [incident] = parseSaCfs(fixture)
    expect(incident.lat).toBeCloseTo(-34.36)
    expect(incident.lon).toBeCloseTo(138.6879)
    expect(incident.category).toBe('fire')
    expect(incident.title).toBe('Building Fire — HAMLEY BRIDGE, MALCOLM STREET')
  })
})

describe('parseWaItems', () => {
  test('strips the trailing CAD-ID parenthetical from incident titles', () => {
    const [incident] = parseWaItems([{
      title: 'Burn Off (CULLALLA, SHIRE OF GINGIN, METRO NORTH COASTAL, CAD-ID: 794773)',
      guid: 'abc', geoLat: '-31.276', geoLong: '116.023', link: 'https://emergency.wa.gov.au/incidents/abc',
    }])
    expect(incident.title).toBe('Burn Off')
    expect(incident.category).toBe('fire')
    expect(incident.severity).toBe(0)
  })

  test('reads graded severity from warnings-feed titles', () => {
    const [incident] = parseWaItems([{
      title: 'Bushfire Advice MONITOR CONDITIONS - WILLARE', guid: 'def', geoLat: '-17.5', geoLong: '123.6',
    }])
    expect(incident.severity).toBe(1)
  })

  test('drops items with missing/invalid coordinates', () => {
    expect(parseWaItems([{ title: 'No coords', guid: 'x' }])).toHaveLength(0)
  })
})

describe('parseTasTfs', () => {
  const kmlFixture = `<kml><Document>
    <Placemark id="26027443">
      <name>Charles Street, LAUNCESTON</name>
      <description>&lt;div&gt;&lt;table&gt;&lt;tr&gt;&lt;th&gt;Type&lt;/th&gt;&lt;td&gt;STRUCTURE FIRE&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;th&gt;Status&lt;/th&gt;&lt;td&gt;Patrol&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;&lt;/div&gt;</description>
      <styleUrl>#noAlertLevelStyle</styleUrl>
      <Point><coordinates>-41.44622352,147.14374168</coordinates></Point>
    </Placemark>
  </Document></kml>`

  test('reads coordinates in lat,lon order (the reverse of standard KML)', () => {
    const [incident] = parseTasTfs(kmlFixture)
    expect(incident.lat).toBeCloseTo(-41.446)
    expect(incident.lon).toBeCloseTo(147.144)
  })

  test('derives severity from styleUrl and fields from the escaped description table', () => {
    const [incident] = parseTasTfs(kmlFixture)
    expect(incident.severity).toBe(0)
    expect(incident.status).toBe('Patrol')
    expect(incident.category).toBe('fire')
    expect(incident.title).toBe('Charles Street, LAUNCESTON')
  })

  test('returns an empty array when there are no placemarks', () => {
    expect(parseTasTfs('<kml><Document></Document></kml>')).toHaveLength(0)
  })
})

describe('parseActEsa', () => {
  test('splits the georss:point "lat lon" string and classifies by type/agency', () => {
    const [incident] = parseActEsa([{
      title: "ELECTRICAL THREAT OR POWER LINES DOWN - YARRALUMLA",
      esaType: 'ELECTRICAL THREAT OR POWER LINES DOWN', esaAgency: 'Fire',
      resourceStatus: 'On Scene', cadid: '010224-23062026',
      georssPoint: '-35.3074961599 149.1030878599',
    }])
    expect(incident.lat).toBeCloseTo(-35.3075)
    expect(incident.lon).toBeCloseTo(149.1031)
    expect(incident.category).toBe('hazmat')
    expect(incident.agency).toBe('Fire') // responding department, not the hazard category
    expect(incident.status).toBe('On Scene')
  })
})
