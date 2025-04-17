import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MapComponent from '../MapComponent.vue'

// Mock Leaflet
vi.mock('leaflet', () => {
  const latLngMock = vi.fn((lat, lng) => ({
    lat,
    lng
  }))
  
  const mapMock = vi.fn(() => ({
    setView: vi.fn().mockReturnThis(),
    remove: vi.fn()
  }))
  
  const tileLayerMock = vi.fn(() => ({
    addTo: vi.fn()
  }))
  
  const markerMock = vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis()
  }))
  
  const iconMock = vi.fn(() => ({
    iconUrl: '',
    iconSize: [],
    iconAnchor: [],
    popupAnchor: []
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
          options: {}
        }
      }
    },
    latLng: latLngMock
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
    expect(wrapper.find('h2').text()).toBe('Stalking...')
    expect(wrapper.find('.map').exists()).toBe(true)
  })

  it('displays the coordinates correctly', async () => {
    const wrapper = mount(MapComponent)
    await flushPromises()
    
    // The coordinates should be displayed in the paragraph
    const coordsText = wrapper.find('p').text()
    expect(coordsText).toContain('59.32721756211293')
    expect(coordsText).toContain('18.107101093216905')
  })

  it('initializes the map when mounted', async () => {
    const wrapper = mount(MapComponent)
    await flushPromises()
    
    // The map should be initialized
    const L = await import('leaflet')
    expect(L.default.map).toHaveBeenCalled()
    expect(L.default.tileLayer).toHaveBeenCalledWith(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.any(Object)
    )
    expect(L.default.marker).toHaveBeenCalled()
  })

  it('cleans up the map when unmounted', async () => {
    const wrapper = mount(MapComponent)
    await flushPromises()
    
    // Unmount the component
    wrapper.unmount()
    
    // The map should be removed
    const L = await import('leaflet')
    const mapInstance = L.default.map.mock.results[0].value
    expect(mapInstance.remove).toHaveBeenCalled()
  })
})