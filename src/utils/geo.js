/** Ray-casting point-in-polygon test against a single linear ring [[lon,lat], ...]. */
function pointInRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const crosses = (yi > lat) !== (yj > lat) &&
      lon < (xj - xi) * (lat - yi) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/** First ring of a polygon is the exterior; any further rings are holes. */
function pointInPolygonRings(lon, lat, rings) {
  if (!rings.length || !pointInRing(lon, lat, rings[0])) return false
  return !rings.slice(1).some(hole => pointInRing(lon, lat, hole))
}

/** Point-in-polygon test supporting GeoJSON Polygon and MultiPolygon geometries. */
export function pointInGeometry(lon, lat, geometry) {
  if (!geometry) return false
  if (geometry.type === 'Polygon') {
    return pointInPolygonRings(lon, lat, geometry.coordinates)
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(rings => pointInPolygonRings(lon, lat, rings))
  }
  return false
}

/** Bounding box [minLon, minLat, maxLon, maxLat] for a GeoJSON Polygon/MultiPolygon geometry. */
export function geometryBounds(geometry) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  const visit = coords => {
    if (typeof coords[0] === 'number') {
      const [lon, lat] = coords
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    } else {
      coords.forEach(visit)
    }
  }
  visit(geometry.coordinates)
  return [minLon, minLat, maxLon, maxLat]
}
