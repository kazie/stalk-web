import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import {
  addStyleSwitcher,
  elevationStorageKey,
  mapStyleStorageKey as storageKey,
} from '../mapStyles'

const vectorStyle = { version: 8, sources: {}, layers: [] }

// Stands in for a MapLibre map, which needs WebGL: controls are rendered into a plain div.
const createMap = () => {
  const container = document.createElement('div')
  document.body.append(container)
  const handlers: Record<string, () => void> = {}
  const map = {
    setStyle: vi.fn(),
    addControl: vi.fn((control: { onAdd: (map: unknown) => HTMLElement }) => {
      container.append(control.onAdd(map))
    }),
    on: vi.fn((event: string, handler: () => void) => {
      handlers[event] = handler
    }),
  }
  const remove = () => handlers.remove!()
  const select = () => container.querySelector('select')!
  const elevationButton = () => container.querySelector('button')!
  const pick = (name: string) => {
    select().value = name
    select().dispatchEvent(new Event('change'))
  }
  return { map, select, elevationButton, pick, remove, asMap: map as unknown as MapLibreMap }
}

describe('addStyleSwitcher', () => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => vectorStyle }))

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    document.body.innerHTML = ''
    window.localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    fetchMock.mockClear()
  })

  it('shows OpenStreetMap by default and offers the vector themes', async () => {
    const { map, select, asMap } = createMap()
    addStyleSwitcher(asMap)

    expect([...select().options].map((option) => option.value)).toEqual([
      'OpenStreetMap',
      'Vector: Liberty',
      'Vector: Bright',
      'Vector: Positron',
      'Vector: Dark',
      'Vector: Fiord',
    ])
    await vi.waitFor(() => expect(map.setStyle).toHaveBeenCalledTimes(1))
    expect(map.setStyle.mock.calls[0]![0].sources.osm.type).toBe('raster')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('remembers the chosen style and restores it on the next visit', async () => {
    const first = createMap()
    addStyleSwitcher(first.asMap)
    first.pick('Vector: Dark')
    expect(window.localStorage.getItem(storageKey)).toBe('Vector: Dark')

    const second = createMap()
    addStyleSwitcher(second.asMap)
    expect(second.select().value).toBe('Vector: Dark')
    await vi.waitFor(() => expect(second.map.setStyle).toHaveBeenCalledWith(vectorStyle))
  })

  it('ignores a stored value that is not a style', async () => {
    window.localStorage.setItem(storageKey, 'constructor')
    const { select, asMap } = createMap()
    addStyleSwitcher(asMap)
    expect(select().value).toBe('OpenStreetMap')
  })

  it('falls back to OpenStreetMap when a style fails to download', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    const { map, select, pick, asMap } = createMap()
    addStyleSwitcher(asMap)
    pick('Vector: Bright')

    await vi.waitFor(() => expect(console.error).toHaveBeenCalled())
    await vi.waitFor(() => expect(select().value).toBe('OpenStreetMap'))
    // A temporary failure keeps the user's choice for the next visit.
    expect(window.localStorage.getItem(storageKey)).toBe('Vector: Bright')
    expect(map.setStyle).not.toHaveBeenCalledWith(vectorStyle)

    // Picking it again retries the download.
    pick('Vector: Bright')
    await vi.waitFor(() => expect(map.setStyle).toHaveBeenCalledWith(vectorStyle))
  })

  it('does not touch the map once it has been removed', async () => {
    let finishDownload!: () => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishDownload = () => resolve({ ok: true, json: async () => vectorStyle })
        }),
    )
    window.localStorage.setItem(storageKey, 'Vector: Positron')
    const { map, remove, asMap } = createMap()
    addStyleSwitcher(asMap)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    remove()
    finishDownload()
    await new Promise((resolve) => setTimeout(resolve))
    expect(map.setStyle).not.toHaveBeenCalled()
  })

  it('toggles elevation on top of the current style and remembers it', async () => {
    const { map, elevationButton, asMap } = createMap()
    addStyleSwitcher(asMap)
    await vi.waitFor(() => expect(map.setStyle).toHaveBeenCalledTimes(1))
    expect(map.setStyle.mock.calls[0]![0].terrain).toBeUndefined()

    elevationButton().click()
    await vi.waitFor(() => expect(map.setStyle).toHaveBeenCalledTimes(2))
    const style = map.setStyle.mock.calls[1]![0]
    expect(style.terrain).toEqual({ source: 'terrain' })
    expect(style.layers.map((layer: { id: string }) => layer.id)).toEqual(['osm', 'hillshade'])
    expect(elevationButton().ariaPressed).toBe('true')
    expect(window.localStorage.getItem(elevationStorageKey)).toBe('true')

    // Restored on the next visit.
    const next = createMap()
    addStyleSwitcher(next.asMap)
    await vi.waitFor(() => expect(next.map.setStyle).toHaveBeenCalledTimes(1))
    expect(next.map.setStyle.mock.calls[0]![0].terrain).toBeDefined()

    elevationButton().click()
    await vi.waitFor(() => expect(map.setStyle).toHaveBeenCalledTimes(3))
    expect(map.setStyle.mock.calls[2]![0].terrain).toBeUndefined()
  })

  it('downloads each style once and ignores styles picked over', async () => {
    const { map, pick, asMap } = createMap()
    addStyleSwitcher(asMap)
    await vi.waitFor(() => expect(map.setStyle).toHaveBeenCalledTimes(1))

    pick('Vector: Fiord')
    pick('OpenStreetMap')
    await vi.waitFor(() => expect(map.setStyle).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve))
    expect(map.setStyle).toHaveBeenCalledTimes(2)
    expect(map.setStyle.mock.calls[1]![0].sources.osm).toBeDefined()

    pick('Vector: Fiord')
    await vi.waitFor(() => expect(map.setStyle).toHaveBeenLastCalledWith(vectorStyle))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
