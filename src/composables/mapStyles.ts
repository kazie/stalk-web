import type {
  ExpressionSpecification,
  Map as MapLibreMap,
  RasterDEMSourceSpecification,
  StyleSpecification,
} from 'maplibre-gl'
import { readStorage, writeStorage } from '@/services/storage'

const defaultMapStyle = 'OpenStreetMap'
export const mapStyleStorageKey = 'stalk.mapStyle'
export const elevationStorageKey = 'stalk.mapElevation'
const openFreeMapThemes = ['Liberty', 'Bright', 'Positron', 'Dark', 'Fiord']

const osmStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

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

// Downloaded once per URL; a failed download is forgotten so the next attempt retries.
const styleDownloads = new Map<string, Promise<StyleSpecification>>()

const loadStyle = (url: string): Promise<StyleSpecification> => {
  let download = styleDownloads.get(url)
  if (!download) {
    download = fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load map style: ${response.status}`)
        return toEnglishLabels(await response.json())
      })
      .catch((error) => {
        styleDownloads.delete(url)
        throw error
      })
    styleDownloads.set(url, download)
  }
  return download
}

const mapStyles: Record<string, () => Promise<StyleSpecification>> = {
  [defaultMapStyle]: async () => osmStyle,
  ...Object.fromEntries(
    openFreeMapThemes.map((theme) => [
      `Vector: ${theme}`,
      () => loadStyle(`https://tiles.openfreemap.org/styles/${theme.toLowerCase()}`),
    ]),
  ),
}

// Free global elevation data (AWS Open Data, no key needed).
const elevationSource: RasterDEMSourceSpecification = {
  type: 'raster-dem',
  tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 15,
  attribution:
    '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Elevation: Mapzen, AWS</a>',
}

// Adds hill shading under the labels, and 3D terrain that shows when the map is tilted.
// MapLibre recommends separate sources for the two.
export const withElevation = (style: StyleSpecification): StyleSpecification => {
  const firstLabel = style.layers.findIndex((layer) => layer.type === 'symbol')
  const at = firstLabel === -1 ? style.layers.length : firstLabel
  return {
    ...style,
    sources: { ...style.sources, hillshade: elevationSource, terrain: elevationSource },
    layers: [
      ...style.layers.slice(0, at),
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'hillshade',
        paint: { 'hillshade-exaggeration': 0.6 },
      },
      ...style.layers.slice(at),
    ],
    terrain: { source: 'terrain' },
  }
}

const createControl = (map: MapLibreMap, child: HTMLElement) => {
  const container = document.createElement('div')
  container.className = 'maplibregl-ctrl maplibregl-ctrl-group'
  container.append(child)
  map.addControl({ onAdd: () => container, onRemove: () => container.remove() }, 'top-right')
}

// Adds a map style picker and an elevation toggle, restoring the choices from the last visit.
export const addStyleSwitcher = (map: MapLibreMap): void => {
  const select = document.createElement('select')
  select.className = 'map-style-switcher'
  select.ariaLabel = 'Map style'
  select.append(...Object.keys(mapStyles).map((name) => new Option(name, name)))

  // Reuses the icon of MapLibre's own terrain control.
  const elevation = document.createElement('button')
  elevation.type = 'button'
  const icon = document.createElement('span')
  icon.className = 'maplibregl-ctrl-icon'
  icon.ariaHidden = 'true'
  elevation.append(icon)
  let elevationShown = false
  const setElevationShown = (shown: boolean) => {
    elevationShown = shown
    elevation.ariaPressed = String(shown)
    elevation.title = shown ? 'Hide elevation' : 'Show elevation'
    elevation.className = shown ? 'maplibregl-ctrl-terrain-enabled' : 'maplibregl-ctrl-terrain'
  }

  let latest = 0
  let removed = false
  const show = async (): Promise<void> => {
    const request = ++latest
    try {
      const style = await mapStyles[select.value]!()
      // Skip if the map is gone or the choice changed while this style downloaded.
      if (removed || request !== latest) return
      map.setStyle(elevationShown ? withElevation(style) : style)
    } catch (error) {
      console.error(error)
      if (removed || request !== latest) return
      // Fall back without saving, so the chosen style is tried again on the next visit.
      select.value = defaultMapStyle
      await show()
    }
  }

  select.addEventListener('change', () => {
    writeStorage(mapStyleStorageKey, select.value)
    void show()
  })
  elevation.addEventListener('click', () => {
    setElevationShown(!elevationShown)
    writeStorage(elevationStorageKey, String(elevationShown))
    void show()
  })
  createControl(map, select)
  createControl(map, elevation)
  map.on('remove', () => (removed = true))

  const saved = readStorage(mapStyleStorageKey)
  select.value = Object.keys(mapStyles).includes(saved) ? saved : defaultMapStyle
  setElevationShown(readStorage(elevationStorageKey) === 'true')
  void show()
}
