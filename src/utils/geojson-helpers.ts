/**
 * Process a GeoJSON feature and return location string and type.
 * Handles Point, LineString, and Polygon geometries.
 * Returns null if feature type is not recognized.
 */
export function processGeoJsonFeature(feature: any): {
  location: string
  locationType: string
} | null {
  if (!feature || !feature.type) return null

  try {
    switch (feature.type) {
      case 'Point': {
        const [lng, lat] = feature.coordinates
        // Use canonical GeoJSON ordering [lon, lat] and store as JSON string
        return {
          location: JSON.stringify({ type: 'Point', coordinates: [lng, lat] }),
          locationType: 'Point',
        }
      }

      case 'LineString': {
        // Represent as GeoJSON string
        return {
          location: JSON.stringify(feature),
          locationType: 'LineString',
        }
      }

      case 'Polygon': {
        return {
          location: JSON.stringify(feature),
          locationType: 'Polygon',
        }
      }

      default:
        return null
    }
  } catch (e) {
    return null
  }
}
