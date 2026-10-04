import L from 'leaflet'
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import { readStorage, writeStorage } from '@/services/storage'

const osmAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const openFreeMapThemes = ['Liberty', 'Bright', 'Positron', 'Dark', 'Fiord']
const openFreeMapAttribution =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'

const defaultMapStyle = 'OpenStreetMap'
const mapStyleStorageKey = 'stalk.mapStyle'

export const englishLabel: ExpressionSpecification = [
  'coalesce',
  ['get', 'name:en'],
  ['get', 'name_en'],
  ['get', 'name:latin'],
  ['get', 'name'],
]

const referencesName = (value: unknown): boolean =>
  typeof value === 'string'
    ? /^name([:_]|$)/.test(value)
    : Array.isArray(value) && value.some(referencesName)

// OpenMapTiles styles render "Latin + native" labels; prefer the English name instead.
export const toEnglishLabels = (style: StyleSpecification): StyleSpecification => ({
  ...style,
  layers: style.layers.map((layer) => {
    if (layer.type !== 'symbol' || !referencesName(layer.layout?.['text-field'])) return layer
    return { ...layer, layout: { ...layer.layout, 'text-field': englishLabel } }
  }),
})

type GlLayerFactory = (options: L.LeafletMaplibreGLOptions) => L.Layer

let mapLibreLoading: Promise<GlLayerFactory> | undefined

const loadMapLibre = () =>
  (mapLibreLoading ??= Promise.all([
    import('maplibre-gl/dist/maplibre-gl.css'),
    import('maplibre-gl'),
    // MapLibre resolves its worker next to its own module, which Vite neither serves nor emits.
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
    import('@maplibre/maplibre-gl-leaflet'),
  ]).then(
    ([, { setWorkerUrl }, { default: workerUrl }, { MaplibreGL }]): GlLayerFactory => {
      setWorkerUrl(workerUrl)
      // The plugin's onRemove assumes its MapLibre map exists, which is not the case when
      // WebGL setup threw during onAdd; without this guard the layer can never be removed.
      // Written against @maplibre/maplibre-gl-leaflet 0.1.4: recheck when upgrading.
      const SafeMaplibreGL = MaplibreGL.extend({
        onRemove(this: L.MaplibreGL & { _glMap?: unknown; _container?: HTMLElement }, map: L.Map) {
          if (this._glMap) MaplibreGL.prototype.onRemove.call(this, map)
          else this._container?.remove()
          return this
        },
      }) as typeof MaplibreGL
      return (options) => new SafeMaplibreGL(options)
    },
    (error) => {
      mapLibreLoading = undefined
      throw error
    },
  ))

const loadStyle = async (url: string): Promise<StyleSpecification> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to load map style: ${response.status}`)
  return toEnglishLabels(await response.json())
}

type LazyVectorLayerOptions = { styleUrl: string; onLoadError: (layer: L.Layer) => void }

type LazyVectorLayerInstance = L.Layer & {
  options: LazyVectorLayerOptions
  _style?: Promise<StyleSpecification>
  _glLayer?: L.Layer
}

// Loads MapLibre only when a vector layer is first selected, keeping it out of the main bundle.
const LazyVectorLayer = L.Layer.extend({
  initialize(this: LazyVectorLayerInstance, options: LazyVectorLayerOptions) {
    L.setOptions(this, options)
  },

  onAdd(this: LazyVectorLayerInstance, map: L.Map) {
    this._style ??= loadStyle(this.options.styleUrl).catch((error) => {
      this._style = undefined
      throw error
    })

    Promise.all([loadMapLibre(), this._style])
      .then(([createGlLayer, style]) => {
        // Skip if the user switched style while loading, or a quicker re-add already finished.
        if (!map.hasLayer(this) || this._glLayer) return
        // A fresh plugin layer per add: the plugin only sizes and positions its container
        // when first created (as of 0.1.4), so a reused layer would be misplaced after panning
        // or resizing.
        this._glLayer = createGlLayer({
          style,
          attributionControl: { customAttribution: openFreeMapAttribution },
        })
        this._glLayer.addTo(map)
      })
      .catch((error) => {
        // Covers failed downloads and MapLibre failing to start (e.g. no WebGL). onLoadError
        // removes this layer, and onRemove then cleans up a half-started MapLibre layer.
        console.error(error)
        if (map.hasLayer(this)) this.options.onLoadError(this)
      })
    return this
  },

  onRemove(this: LazyVectorLayerInstance, map: L.Map) {
    if (this._glLayer) map.removeLayer(this._glLayer)
    this._glLayer = undefined
    return this
  },
}) as new (options: LazyVectorLayerOptions) => L.Layer

// Adds the base map plus a style switcher, remembering the chosen style between visits.
export const addBaseLayerSwitcher = (map: L.Map): Record<string, L.Layer> => {
  const defaultLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: osmAttribution,
  })
  // A vector style that fails to load falls back to the default tiles.
  const fallBackToDefault = (failed: L.Layer): void => {
    map.removeLayer(failed)
    defaultLayer.addTo(map)
    writeStorage(mapStyleStorageKey, defaultMapStyle)
  }

  const baseLayers: Record<string, L.Layer> = { [defaultMapStyle]: defaultLayer }
  for (const theme of openFreeMapThemes) {
    baseLayers[`Vector: ${theme}`] = new LazyVectorLayer({
      styleUrl: `https://tiles.openfreemap.org/styles/${theme.toLowerCase()}`,
      onLoadError: fallBackToDefault,
    })
  }

  const initialLayer = baseLayers[readStorage(mapStyleStorageKey)] ?? defaultLayer
  initialLayer.addTo(map)
  L.control.layers(baseLayers).addTo(map)
  map.on('baselayerchange', (event) => writeStorage(mapStyleStorageKey, event.name))
  return baseLayers
}
