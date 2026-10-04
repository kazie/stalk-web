import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MapComponent from '../MapComponent.vue'
import type { MarkerData } from '@/services/markerService.ts'

// Mock vue-router
const mockRouterPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: mockRouterPush,
  })),
}))

// Mock the marker service
vi.mock('@/services/markerService', () => {
  // Create a simple reactive object that mimics a Vue ref
  const createMockRef = <T>(value: T) => ({
    value,
    __v_isRef: true as const,
  })

  // Define enums and constants for the mock
  const ZoomLevel = {
    Close: 17,
    Medium: 14,
    Far: 9,
    VeryFar: 5,
  }
  const UpdateMode = {
    Poll: 'poll',
    Live: 'live',
  } as const

  return {
    markers: createMockRef<Array<MarkerData>>([
      {
        name: 'Test Marker 1',
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: '2025-01-01T00:00:00.000Z',
      },
      {
        name: 'Test Marker 2',
        latitude: 51.5074,
        longitude: -0.1278,
        timestamp: '2025-01-01T00:00:00.000Z',
      },
    ]),
    isLoading: createMockRef(false),
    error: createMockRef(null),
    currentName: createMockRef(null),
    freeRoamingMode: createMockRef(false),
    updateFrequency: createMockRef(5000),
    currentZoomLevel: createMockRef(ZoomLevel.Medium),
    updateMode: createMockRef(UpdateMode.Live),
    ZoomLevel,
    UpdateMode,
    // Polling APIs (kept for backward compatibility in tests)
    startFetching: vi.fn(),
    stopFetching: vi.fn(),
    fetchMarkerData: vi.fn(),
    fetchMarkerByName: vi.fn(),
    startFetchingByName: vi.fn(),
    // Live mode APIs
    startLive: vi.fn(),
    startLiveByName: vi.fn(),
    stopLive: vi.fn(),
    stopUpdates: vi.fn(),
    // UI control helpers
    toggleFreeRoamingMode: vi.fn(),
    setUpdateFrequency: vi.fn(),
    setZoomLevel: vi.fn(),
    setUpdateMode: vi.fn(),
  }
})

// Mock MapLibre, which needs WebGL
vi.mock('maplibre-gl', () => {
  // Every method returns its instance, like MapLibre's chainable API.
  const chainable = <T extends Record<string, Mock>>(methods: T): T => {
    for (const fn of Object.values(methods)) fn.mockReturnValue(methods)
    return methods
  }

  const Map = vi.fn(function () {
    return chainable({
      addControl: vi.fn(),
      once: vi.fn(),
      easeTo: vi.fn(),
      fitBounds: vi.fn(),
      getBearing: vi.fn(),
      remove: vi.fn(),
    })
  })
  const Popup = vi.fn(function () {
    return chainable({ setDOMContent: vi.fn() })
  })
  const Marker = vi.fn(function () {
    return chainable({ setLngLat: vi.fn(), setPopup: vi.fn(), addTo: vi.fn(), remove: vi.fn() })
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

// The style switcher has its own tests.
vi.mock('@/composables/mapStyles', () => ({ addStyleSwitcher: vi.fn() }))

describe('MapComponent', () => {
  beforeEach(async () => {
    // Tests without markers force free roaming on.
    const markerService = await import('@/services/markerService')
    markerService.freeRoamingMode.value = false

    // Create a div to mount the map
    const mapDiv = document.createElement('div')
    mapDiv.id = 'map-container'
    document.body.appendChild(mapDiv)
  })

  afterEach(() => {
    // Clean up
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('renders properly', async () => {
    const wrapper = mount(MapComponent)
    await flushPromises()

    // Check if the component renders correctly
    expect(wrapper.find('.map-container').exists()).toBe(true)
    expect(wrapper.find('h2').text()).toBe('Stalking... everyone')
    expect(wrapper.find('.map').exists()).toBe(true)
  })

  it('displays the markers list correctly', async () => {
    const wrapper = mount(MapComponent)
    await flushPromises()

    // The markers should be displayed in the list
    expect(wrapper.find('.markers-list').exists()).toBe(true)
    expect(wrapper.find('h3').text()).toBe('Current Markers (2)')

    const markerItems = wrapper.findAll('.markers-list li')
    expect(markerItems.length).toBe(2)
    const first = markerItems[0]!
    const second = markerItems[1]!
    expect(first.text()).toContain('Test Marker 1')
    expect(first.text()).toContain('40.71280')
    expect(first.text()).toContain('-74.00600')

    expect(second.text()).toContain('Test Marker 2')
    expect(second.text()).toContain('51.50740')
    expect(second.text()).toContain('-0.12780')
  })

  it('allows expanding and collapsing the markers menu', async () => {
    const wrapper = mount(MapComponent)
    await flushPromises()

    // Initially collapsed by default
    expect(wrapper.vm.isMenuExpanded).toBe(false)
    expect(wrapper.find('.markers-info').classes()).toContain('collapsed')

    // Click header to expand
    await wrapper.find('.markers-header').trigger('click')
    expect(wrapper.vm.isMenuExpanded).toBe(true)
    expect(wrapper.find('.markers-info').classes()).not.toContain('collapsed')

    // Click menu toggle button to collapse
    await wrapper.find('.menu-toggle-btn').trigger('click')
    expect(wrapper.vm.isMenuExpanded).toBe(false)
    expect(wrapper.find('.markers-info').classes()).toContain('collapsed')
  })

  it('navigates when clicking on a marker name', async () => {
    const wrapper = mount(MapComponent)
    await flushPromises()

    const firstMarkerName = wrapper.find('.marker-name')
    await firstMarkerName.trigger('click')

    expect(mockRouterPush).toHaveBeenCalledWith('/Test Marker 1')
  })

  it('disables the free roaming toggle button when there are no markers', async () => {
    // Save the original mock implementation
    const originalMock = vi.importActual('@/services/markerService')

    // Override the markers value for this test
    const markerService = await import('@/services/markerService')
    const originalMarkers = [...markerService.markers.value]
    markerService.markers.value = []

    // Mount the component with empty markers
    const wrapper = mount(MapComponent)
    await flushPromises()

    // The free roaming toggle button should be disabled
    const freeRoamingButton = wrapper.find('.free-roaming-toggle')
    expect(freeRoamingButton.attributes('disabled')).toBeDefined()
    expect(freeRoamingButton.attributes('title')).toBe(
      'Free roaming is enforced when there are no markers',
    )

    // Restore the original markers
    markerService.markers.value = originalMarkers
  })

  it('initializes the map and starts fetching when mounted', async () => {
    const wrapper = mount(MapComponent)
    await flushPromises()

    // The map should be initialized
    const maplibre = await import('maplibre-gl')
    expect(maplibre.Map).toHaveBeenCalled()
    const map = vi.mocked(maplibre.Map).mock.results[0]!.value
    const { addStyleSwitcher } = await import('@/composables/mapStyles')
    expect(addStyleSwitcher).toHaveBeenCalledWith(map)

    // Should start live updates by default
    const markerService = await import('@/services/markerService')
    expect(markerService.startLive).toHaveBeenCalled()

    // Should add a marker with a popup per person and fit the map to them
    expect(maplibre.Marker).toHaveBeenCalledTimes(2)
    const marker = vi.mocked(maplibre.Marker).mock.results[0]!.value
    expect(marker.setLngLat).toHaveBeenCalledWith([-74.006, 40.7128])
    expect(marker.addTo).toHaveBeenCalledWith(map)
    const popup = vi.mocked(maplibre.Popup).mock.results[0]!.value
    expect(marker.setPopup).toHaveBeenCalledWith(popup)
    const popupContent = popup.setDOMContent.mock.calls[0][0] as HTMLElement
    expect(popupContent.textContent).toMatch(/^Test Marker 1 \S/)
    map.getBearing.mockReturnValue(30)
    map.fitBounds.mockClear()
    // Fit again as when the map finishes loading, after the user has rotated it.
    map.once.mock.calls[0]![1]()
    expect(map.fitBounds).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ bearing: 30, maxZoom: 17 }),
    )
  })

  it('shows a message instead of the map when WebGL is unavailable', async () => {
    const maplibre = await import('maplibre-gl')
    vi.mocked(maplibre.Map).mockImplementationOnce(function () {
      throw new maplibre.GPUInitializationError({}, null)
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(MapComponent)
    await flushPromises()

    expect(wrapper.text()).toContain("doesn't support WebGL 2")
    expect(maplibre.Marker).not.toHaveBeenCalled()
    // The people list still works.
    expect(wrapper.findAll('.markers-list li')).toHaveLength(2)
  })

  it('cleans up the map and stops fetching when unmounted', async () => {
    const wrapper = mount(MapComponent)
    await flushPromises()

    // Unmount the component
    wrapper.unmount()

    // The map should be removed
    const maplibre = await import('maplibre-gl')
    const mapInstance = vi.mocked(maplibre.Map).mock.results[0]!.value
    expect(mapInstance.remove).toHaveBeenCalled()

    // Should stop updates
    const markerService = await import('@/services/markerService')
    expect(markerService.stopUpdates).toHaveBeenCalled()
  })
})
