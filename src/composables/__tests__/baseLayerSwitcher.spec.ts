import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import L from 'leaflet'
import { addBaseLayerSwitcher } from '../mapBaseLayers'

const { glOnAdd, gl } = vi.hoisted(() => ({ glOnAdd: vi.fn(), gl: { fails: true } }))

vi.mock('maplibre-gl', () => ({ setWorkerUrl: vi.fn() }))
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: 'worker.js' }))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

// Mimics the plugin. With gl.fails, MapLibre cannot get a WebGL context: onAdd throws after
// attaching its container, and onRemove dereferences the MapLibre map that was never created.
vi.mock('@maplibre/maplibre-gl-leaflet', async () => {
  const { default: Leaflet } = await vi.importActual<{ default: typeof L }>('leaflet')
  const MaplibreGL = Leaflet.Layer.extend({
    onAdd(this: { _container?: HTMLElement }, map: L.Map) {
      this._container = Leaflet.DomUtil.create('div', 'gl-container', map.getPane('tilePane'))
      glOnAdd(this)
      if (gl.fails) throw new Error('WebGL unavailable')
      ;(this as { _glMap?: object })._glMap = { remove: () => {} }
    },
    onRemove(this: { _glMap: { remove: () => void }; _container: HTMLElement }) {
      this._glMap.remove()
      this._container.remove()
    },
  })
  return { MaplibreGL }
})

const storageKey = 'stalk.mapStyle'

describe('addBaseLayerSwitcher', () => {
  let map: L.Map
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ version: 8, sources: {}, layers: [] }),
  }))

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const container = document.createElement('div')
    document.body.appendChild(container)
    map = L.map(container).setView([0, 0], 2)
  })

  afterEach(() => {
    map.remove()
    document.body.innerHTML = ''
    window.localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    fetchMock.mockClear()
    glOnAdd.mockClear()
    gl.fails = true
  })

  it('shows OpenStreetMap by default and offers the vector themes', () => {
    const layers = addBaseLayerSwitcher(map)

    expect(Object.keys(layers)).toEqual([
      'OpenStreetMap',
      'Vector: Liberty',
      'Vector: Bright',
      'Vector: Positron',
      'Vector: Dark',
      'Vector: Fiord',
    ])
    expect(map.hasLayer(layers.OpenStreetMap!)).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('remembers the chosen style', () => {
    addBaseLayerSwitcher(map)
    map.fire('baselayerchange', { name: 'Vector: Dark' })
    expect(window.localStorage.getItem(storageKey)).toBe('Vector: Dark')
  })

  it('falls back to OpenStreetMap when MapLibre fails to start', async () => {
    window.localStorage.setItem(storageKey, 'Vector: Liberty')
    const layers = addBaseLayerSwitcher(map)
    const vector = layers['Vector: Liberty']!

    await vi.waitFor(() => expect(map.hasLayer(layers.OpenStreetMap!)).toBe(true))
    expect(map.hasLayer(vector)).toBe(false)
    expect(map.getPane('tilePane')!.querySelector('.gl-container')).toBeNull()
    expect(window.localStorage.getItem(storageKey)).toBe('OpenStreetMap')

    // Selecting the style again retries MapLibre but reuses the downloaded style.
    map.removeLayer(layers.OpenStreetMap!)
    vector.addTo(map)
    await vi.waitFor(() => expect(glOnAdd).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(map.hasLayer(layers.OpenStreetMap!)).toBe(true))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('creates a fresh MapLibre layer each time a style is shown', async () => {
    gl.fails = false
    const layers = addBaseLayerSwitcher(map)
    const vector = layers['Vector: Liberty']!

    // The plugin only positions its container when created, so reuse would misplace it.
    map.removeLayer(layers.OpenStreetMap!)
    vector.addTo(map)
    await vi.waitFor(() => expect(glOnAdd).toHaveBeenCalledTimes(1))
    map.removeLayer(vector)
    vector.addTo(map)
    await vi.waitFor(() => expect(glOnAdd).toHaveBeenCalledTimes(2))

    expect(glOnAdd.mock.calls[1]![0]).not.toBe(glOnAdd.mock.calls[0]![0])
    expect(map.getPane('tilePane')!.querySelectorAll('.gl-container')).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
