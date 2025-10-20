import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw' // side-effect to register draw handlers on L

function DrawControl({ feature, onFeature }: { feature?: any | null; onFeature: (geojson: any | null) => void }) {
  const map = useMap()
  const drawLayerRef = useRef<L.FeatureGroup | null>(null)

  useEffect(() => {
    if (!map) return

    // Ensure any previous draw control/layers are cleaned up before re-creating
    if (drawLayerRef.current) {
      try {
        map.removeLayer(drawLayerRef.current)
      } catch (e) {
        // ignore
      }
      drawLayerRef.current = null
    }

    const drawnItems = new L.FeatureGroup()
    drawLayerRef.current = drawnItems
    map.addLayer(drawnItems)

    // If parent provided a feature, render it and keep it in drawnItems
    try {
        if (feature) {
        if (feature.type === 'FeatureCollection' && Array.isArray(feature.features)) {
          // Only initialize with the first feature to enforce single-feature mode
          const f = feature.features[0]
          if (f) {
            const ly = L.geoJSON(f)
            drawnItems.addLayer(ly)
          }
        } else {
          let layer: any = null
          if (feature.type === 'Point') {
            const [lng, lat] = feature.coordinates
            // Use a Marker so toGeoJSON() yields a GeoJSON Point geometry
            layer = L.marker([lat, lng])
          } else if (feature.type === 'LineString') {
            const latlngs = feature.coordinates.map((c: any) => [c[1], c[0]])
            layer = L.polyline(latlngs)
          } else if (feature.type === 'Polygon') {
            const coords = feature.coordinates[0].map((c: any) => [c[1], c[0]])
            layer = L.polygon(coords)
          } else {
            const ly = L.geoJSON(feature)
            layer = ly
          }
          if (layer) drawnItems.addLayer(layer)
        }
      }
    } catch (e) {
      // ignore
    }

    const drawControl = new (L.Control as any).Draw({
      edit: { featureGroup: drawnItems },
      draw: {
        polygon: true,
        polyline: true,
        rectangle: false,
        circle: false,
        marker: true,
        circlemarker: false,
      },
    })
    map.addControl(drawControl)

    const toGeoJson = () => {
      const layers = drawnItems.getLayers()
      if (!layers || layers.length === 0) return null
      if (layers.length === 1) {
        const geo = (layers[0] as any).toGeoJSON().geometry
        if (!geo) return null
        // Normalize Point coordinate order to [lon, lat]
        if (geo.type === 'Point' && Array.isArray(geo.coordinates)) {
          const [lng, lat] = geo.coordinates
          return { type: 'Point', coordinates: [lng, lat] }
        }
        // For other geometry types, return as-is
        return geo
      }
      // multiple layers -> FeatureCollection
      const features = layers.map((ly: any) => ly.toGeoJSON())
      return { type: 'FeatureCollection', features }
    }

    const created = (e: any) => {
      const layer = e.layer
      // Enforce single-feature: clear any existing layers before adding the new one
      try {
        const existing = drawnItems.getLayers()
        if (existing && existing.length > 0) drawnItems.clearLayers()
      } catch (err) {
        // ignore
      }
      drawnItems.addLayer(layer)
      onFeature(toGeoJson())
    }

    const edited = () => {
      onFeature(toGeoJson())
    }

    const deleted = () => {
      onFeature(toGeoJson())
    }

    map.on('draw:created', created)
    map.on('draw:edited', edited)
    map.on('draw:deleted', deleted)

    return () => {
      map.off('draw:created', created)
      map.off('draw:edited', edited)
      map.off('draw:deleted', deleted)
      map.removeControl(drawControl)
      try {
        map.removeLayer(drawnItems)
      } catch (e) {
        // ignore
      }
    }
  }, [map, onFeature, feature])

  return null
}

export default function MapCard({ feature, onFeature }: { feature?: any | null; onFeature: (geojson: any | null) => void }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Create a Location Payload</h3>
      <p>Use the drawing tools to create a feature thats's added to the attestation form.</p>
      <p>Feature is added to the <b>location</b> field as a geojson string.</p>
      <div style={{ height: '60vh' }}>
        <MapContainer center={[40.7128, -74.006]} zoom={5} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <DrawControl feature={feature} onFeature={onFeature} />
        </MapContainer>
      </div>
    </div>
  )
}
