import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    startFetching: vi.fn(),
    stopFetching: vi.fn(),
    fetchMarkerData: vi.fn(),
    fetchMarkerByName: vi.fn(),
    startFetchingByName: vi.fn(),
  }
})

// Mock Leaflet
vi.mock('leaflet', () => {
  const latLngMock = vi.fn((latitude, longitude) => ({
    lat: latitude,
    lng: longitude,
  }))

  const mapMock = vi.fn(() => ({
    setView: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  }))

  const tileLayerMock = vi.fn(() => ({
    addTo: vi.fn(),
  }))

  const markerMock = vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
  }))

  const iconMock = vi.fn(() => ({
    iconUrl: '',
    iconSize: [],
    iconAnchor: [],
    popupAnchor: [],
  }))

  return {
    default: {
      map: mapMock,
      tileLayer: tileLayerMock,
      marker: markerMock,
      icon: iconMock,
      latLng: latLngMock,
      Marker: {
        prototype: {
          options: {},
        },
      },
    },
    latLng: latLngMock,
  }
})

// Mock the image imports
vi.mock('leaflet/dist/images/marker-icon.png', () => '')
vi.mock('leaflet/dist/images/marker-shadow.png', () => '')

describe('MapComponent', () => {
  beforeEach(() => {
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
    expect(markerItems[0].text()).toContain('Test Marker 1')
    expect(markerItems[0].text()).toContain('40.71280')
    expect(markerItems[0].text()).toContain('-74.00600')

    expect(markerItems[1].text()).toContain('Test Marker 2')
    expect(markerItems[1].text()).toContain('51.50740')
    expect(markerItems[1].text()).toContain('-0.12780')
  })

  it('initializes the map and starts fetching when mounted', async () => {
    const wrapper = mount(MapComponent)
    await flushPromises()

    // The map should be initialized
    const L = await import('leaflet')
    expect(L.default.map).toHaveBeenCalled()
    expect(L.default.tileLayer).toHaveBeenCalledWith(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.any(Object),
    )

    // Should start fetching data
    const markerService = await import('@/services/markerService')
    expect(markerService.startFetching).toHaveBeenCalled()
  })

  it('cleans up the map and stops fetching when unmounted', async () => {
    const wrapper = mount(MapComponent)
    await flushPromises()

    // Unmount the component
    wrapper.unmount()

    // The map should be removed
    const L = await import('leaflet')
    const mapInstance = vi.mocked(L.default.map).mock.results[0].value
    expect(mapInstance.remove).toHaveBeenCalled()

    // Should stop fetching data
    const markerService = await import('@/services/markerService')
    expect(markerService.stopFetching).toHaveBeenCalled()
  })
})
