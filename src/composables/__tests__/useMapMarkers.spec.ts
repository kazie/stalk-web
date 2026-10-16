import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { markers, freeRoamingMode, type MarkerData } from '@/services/markerService'
import { useMapMarkers } from '../useMapMarkers'

type MapMock = { getBearing: Mock; handlers: Map<string, () => void> }

// MapLibre needs WebGL, which jsdom lacks. The mocks keep the marker elements and popup content
// that the composable builds, so the tests can check the real DOM.
const maps: MapMock[] = []
const markerElements: HTMLElement[] = []
const popupContents: HTMLElement[] = []

vi.mock('maplibre-gl', () => {
  const chainable = <T extends Record<string, Mock>>(methods: T): T => {
    for (const fn of Object.values(methods)) fn.mockReturnValue(methods)
    return methods
  }

  const Map = vi.fn(function () {
    const handlers = new globalThis.Map<string, () => void>()
    const map = chainable({
      addControl: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      easeTo: vi.fn(),
      fitBounds: vi.fn(),
      getBearing: vi.fn(),
      remove: vi.fn(),
    })
    map.on.mockImplementation((event: string, handler: () => void) => {
      handlers.set(event, handler)
      return map
    })
    map.getBearing.mockReturnValue(0)
    const mock = Object.assign(map, { handlers })
    maps.push(mock)
    return mock
  })
  const Popup = vi.fn(function () {
    const popup = chainable({ setDOMContent: vi.fn() })
    popup.setDOMContent.mockImplementation((content: HTMLElement) => {
      popupContents.push(content)
      return popup
    })
    return popup
  })
  const Marker = vi.fn(function (options: { element: HTMLElement }) {
    markerElements.push(options.element)
    document.body.appendChild(options.element)
    const marker = chainable({
      setLngLat: vi.fn(),
      setPopup: vi.fn(),
      addTo: vi.fn(),
      remove: vi.fn(),
    })
    marker.remove.mockImplementation(() => {
      options.element.remove()
      return marker
    })
    return marker
  })
  const LngLatBounds = vi.fn(function () {
    return chainable({ extend: vi.fn() })
  })
  class GPUInitializationError extends Error {}

  return {
    Map,
    Marker,
    Popup,
    LngLatBounds,
    NavigationControl: vi.fn(),
    GPUInitializationError,
    setWorkerUrl: vi.fn(),
  }
})
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: 'worker.js' }))
vi.mock('../mapStyles', () => ({ addStyleSwitcher: vi.fn() }))

const Host = defineComponent({
  setup() {
    const { mapContainer, mapError } = useMapMarkers()
    return () => h('div', [h('div', { ref: mapContainer }), h('p', mapError.value ?? '')])
  },
})

const fresh = () => new Date().toISOString()

const mountWithMarkers = async (data: MarkerData[]) => {
  markers.value = data
  const wrapper = mount(Host, { attachTo: document.body })
  await nextTick()
  return wrapper
}

const markerParts = (index = 0) => {
  const element = markerElements[index]
  if (!element) throw new Error(`No marker at index ${index}`)
  return {
    avatar: element.querySelector('.stalk-avatar') as HTMLImageElement,
    frame: element.querySelector('.heading-frame') as HTMLElement,
    orbit: element.querySelector('.heading-orbit') as HTMLElement,
    label: element.querySelector('.speed-label') as HTMLElement,
    popup: popupContents[index]!,
  }
}

beforeEach(() => {
  freeRoamingMode.value = false
})

afterEach(() => {
  maps.length = 0
  markerElements.length = 0
  popupContents.length = 0
  markers.value = []
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('useMapMarkers motion indicators', () => {
  it('shows the arrow rotated to the heading and the speed label for a moving target', async () => {
    const wrapper = await mountWithMarkers([
      { name: 'mover', latitude: 1, longitude: 2, timestamp: fresh(), speed: 8.3333, heading: 45 },
    ])

    const { orbit, label, popup } = markerParts()
    expect(orbit.hidden).toBe(false)
    expect(orbit.style.transform).toBe('rotate(45deg)')
    expect(label.hidden).toBe(false)
    expect(label.textContent).toBe('30 km/h')
    expect(popup.textContent).toContain('mover')
    expect(popup.textContent).toContain('30 km/h · NE')
    wrapper.unmount()
  })

  it('hides the arrow and reads 0 km/h for a stationary target', async () => {
    const wrapper = await mountWithMarkers([
      { name: 'still', latitude: 1, longitude: 2, timestamp: fresh(), speed: 0.2, heading: 45 },
    ])

    const { orbit, label } = markerParts()
    expect(orbit.hidden).toBe(true)
    expect(label.hidden).toBe(false)
    expect(label.textContent).toBe('0 km/h')
    wrapper.unmount()
  })

  it('hides both indicators without motion data or when the fix is stale', async () => {
    const stale = new Date(Date.now() - 3 * 60_000).toISOString()
    const wrapper = await mountWithMarkers([
      { name: 'nodata', latitude: 1, longitude: 2, timestamp: fresh() },
      { name: 'stale', latitude: 3, longitude: 4, timestamp: stale, speed: 20, heading: 90 },
    ])

    for (const index of [0, 1]) {
      const { orbit, label } = markerParts(index)
      expect(orbit.hidden).toBe(true)
      expect(label.hidden).toBe(true)
    }
    wrapper.unmount()
  })

  it('rotates the shortest way across north and clears indicators when data disappears', async () => {
    const wrapper = await mountWithMarkers([
      { name: 'mover', latitude: 1, longitude: 2, timestamp: fresh(), speed: 10, heading: 350 },
    ])
    const { orbit, label } = markerParts()
    expect(orbit.style.transform).toBe('rotate(-10deg)')

    markers.value = [
      { name: 'mover', latitude: 1.1, longitude: 2, timestamp: fresh(), speed: 10, heading: 10 },
    ]
    await nextTick()
    // The same DOM node is updated in place
    expect(markerElements).toHaveLength(1)
    expect(orbit.style.transform).toBe('rotate(10deg)')

    markers.value = [
      { name: 'mover', latitude: 1.2, longitude: 2, timestamp: fresh(), speed: 10, heading: 350 },
    ]
    await nextTick()
    expect(orbit.style.transform).toBe('rotate(-10deg)')

    markers.value = [{ name: 'mover', latitude: 1.3, longitude: 2, timestamp: fresh() }]
    await nextTick()
    expect(orbit.hidden).toBe(true)
    expect(label.hidden).toBe(true)
    wrapper.unmount()
  })

  it('counter-rotates the arrows when the map is rotated', async () => {
    const wrapper = await mountWithMarkers([
      { name: 'mover', latitude: 1, longitude: 2, timestamp: fresh(), speed: 10, heading: 90 },
    ])
    const map = maps[0]!
    const { frame, orbit } = markerParts()
    expect(frame.style.transform).toBe('rotate(0deg)')

    map.getBearing.mockReturnValue(30)
    map.handlers.get('rotate')!()
    expect(frame.style.transform).toBe('rotate(-30deg)')
    // The heading itself is unchanged
    expect(orbit.style.transform).toBe('rotate(90deg)')

    // New markers start at the current bearing
    markers.value = [
      ...markers.value,
      { name: 'other', latitude: 3, longitude: 4, timestamp: fresh(), speed: 10, heading: 0 },
    ]
    await nextTick()
    expect(markerParts(1).frame.style.transform).toBe('rotate(-30deg)')
    wrapper.unmount()
  })

  it('keeps the GitHub avatar for kazie and never interprets names as HTML', async () => {
    const wrapper = await mountWithMarkers([
      { name: 'kazie', latitude: 1, longitude: 2, timestamp: fresh() },
      { name: '<b>x</b>', latitude: 3, longitude: 4, timestamp: fresh() },
    ])

    const kazie = markerParts(0).avatar
    expect(kazie.src).toBe('https://avatars.githubusercontent.com/u/1390887')
    expect(kazie.classList.contains('rounded-icon')).toBe(true)
    const other = markerParts(1)
    expect(other.avatar.src).toContain('https://ui-avatars.com/api/')
    expect(other.avatar.classList.contains('rounded-icon')).toBe(false)
    expect(other.popup.querySelector('b')!.textContent).toBe('<b>x</b>')
    wrapper.unmount()
  })
})

describe('useMapMarkers WebGL context', () => {
  it('shows an error while the WebGL context is lost and clears it once restored', async () => {
    const wrapper = await mountWithMarkers([])
    const map = maps[0]!

    map.handlers.get('webglcontextlost')!()
    await nextTick()
    expect(wrapper.text()).toContain('lost its WebGL context')

    map.handlers.get('webglcontextrestored')!()
    await nextTick()
    expect(wrapper.text()).not.toContain('lost its WebGL context')
    wrapper.unmount()
  })
})
