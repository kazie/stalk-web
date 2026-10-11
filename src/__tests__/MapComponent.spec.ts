import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import L from 'leaflet'
import MapComponent from '../components/MapComponent.vue'
import * as markerService from '../services/markerService'

// Mock the vue-router
const mockRouterPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: mockRouterPush,
  })),
}))

// Mock the markerService
vi.mock('../services/markerService', async () => {
  const actual = await vi.importActual('../services/markerService')
  return {
    ...actual,
    // Keep reactive refs and enums from actual
    updateMode: actual.updateMode,
    UpdateMode: actual.UpdateMode,
    currentName: actual.currentName,
    markers: actual.markers,
    isLoading: actual.isLoading,
    error: actual.error,
    // Mock methods
    startFetching: vi.fn(),
    stopFetching: vi.fn(),
    startFetchingByName: vi.fn(),
    fetchMarkerByName: vi.fn(),
    startLive: vi.fn(),
    startLiveByName: vi.fn(),
    stopUpdates: vi.fn(),
  }
})

describe('MapComponent', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Set up mock data for markers
    markerService.markers.value = [
      {
        name: 'test',
        latitude: 1.12345,
        longitude: 2.12345,
        timestamp: '2023-01-01T00:00:00Z',
      },
    ]
    markerService.isLoading.value = false
    markerService.error.value = null
    markerService.currentName.value = null

    // Mock Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 500,
      height: 500,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should start live updates when no name is provided', async () => {
      mount(MapComponent, {
        props: {
          name: undefined,
        },
      })

      await nextTick()

      expect(markerService.stopUpdates).toHaveBeenCalledTimes(1)
      expect(markerService.startLive).toHaveBeenCalledTimes(1)
      expect(markerService.startLiveByName).not.toHaveBeenCalled()
    })

    it('should start live updates by name when a name is provided', async () => {
      mount(MapComponent, {
        props: {
          name: 'test',
        },
      })

      await nextTick()

      expect(markerService.stopUpdates).toHaveBeenCalledTimes(1)
      expect(markerService.startLiveByName).toHaveBeenCalledTimes(1)
      expect(markerService.startLiveByName).toHaveBeenCalledWith('test')
      expect(markerService.startLive).not.toHaveBeenCalled()
    })
  })

  describe('watch function for name prop', () => {
    it('should update live updates when name prop changes from null to a value', async () => {
      const wrapper = mount(MapComponent, {
        props: {
          name: undefined,
        },
      })

      // Reset mocks after initial mount
      vi.resetAllMocks()

      // Update the name prop
      await wrapper.setProps({ name: 'test' })

      expect(markerService.stopUpdates).toHaveBeenCalledTimes(1)
      expect(markerService.startLiveByName).toHaveBeenCalledTimes(1)
      expect(markerService.startLiveByName).toHaveBeenCalledWith('test')
      expect(markerService.startLive).not.toHaveBeenCalled()
    })

    it('should update live updates when name prop changes from a value to null', async () => {
      const wrapper = mount(MapComponent, {
        props: {
          name: 'test',
        },
      })

      // Reset mocks after initial mount
      vi.resetAllMocks()

      // Update the name prop
      await wrapper.setProps({ name: undefined })

      expect(markerService.stopUpdates).toHaveBeenCalledTimes(1)
      expect(markerService.startLive).toHaveBeenCalledTimes(1)
      expect(markerService.startLiveByName).not.toHaveBeenCalled()
    })

    it('should update live updates when name prop changes from one value to another', async () => {
      const wrapper = mount(MapComponent, {
        props: {
          name: 'test1',
        },
      })

      // Reset mocks after initial mount
      vi.resetAllMocks()

      // Update the name prop
      await wrapper.setProps({ name: 'test2' })

      expect(markerService.stopUpdates).toHaveBeenCalledTimes(1)
      expect(markerService.startLiveByName).toHaveBeenCalledTimes(1)
      expect(markerService.startLiveByName).toHaveBeenCalledWith('test2')
      expect(markerService.startLive).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('should stop updates when component is unmounted', async () => {
      const wrapper = mount(MapComponent)

      // Reset mocks after initial mount
      vi.resetAllMocks()

      // Unmount the component
      wrapper.unmount()

      expect(markerService.stopUpdates).toHaveBeenCalledTimes(1)
    })
  })

  describe('motion indicators', () => {
    const fresh = () => new Date().toISOString()

    const mountWithMarkers = async (data: markerService.MarkerData[]) => {
      markerService.markers.value = data
      const wrapper = mount(MapComponent, { attachTo: document.body })
      await nextTick()
      return wrapper
    }

    const markerElement = (wrapper: ReturnType<typeof mount>, index = 0) => {
      const element = wrapper.findAll('.stalk-marker')[index]
      if (!element) throw new Error(`No marker at index ${index}`)
      return {
        avatar: element.find('.stalk-avatar').element as HTMLImageElement,
        orbit: element.find('.heading-orbit').element as HTMLElement,
        label: element.find('.speed-label').element as HTMLElement,
      }
    }

    it('shows the triangle rotated to the heading and the speed label for a moving target', async () => {
      const wrapper = await mountWithMarkers([
        {
          name: 'mover',
          latitude: 1,
          longitude: 2,
          timestamp: fresh(),
          speed: 8.3333,
          heading: 45,
        },
      ])

      const { orbit, label } = markerElement(wrapper)
      expect(orbit.hidden).toBe(false)
      expect(orbit.style.transform).toBe('rotate(45deg)')
      expect(label.hidden).toBe(false)
      expect(label.textContent).toBe('30 km/h')

      await wrapper.find('.stalk-marker-icon').trigger('click')
      const popup = wrapper.find('.leaflet-popup-content')
      expect(popup.text()).toContain('mover')
      expect(popup.text()).toContain('30 km/h · NE')
      expect(wrapper.find('.marker-motion').text()).toBe('· 30 km/h NE')
      wrapper.unmount()
    })

    it('hides the triangle and reads 0 km/h for a stationary target', async () => {
      const wrapper = await mountWithMarkers([
        { name: 'still', latitude: 1, longitude: 2, timestamp: fresh(), speed: 0.2, heading: 45 },
      ])

      const { orbit, label } = markerElement(wrapper)
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
        const { orbit, label } = markerElement(wrapper, index)
        expect(orbit.hidden).toBe(true)
        expect(label.hidden).toBe(true)
      }
      for (const motion of wrapper.findAll('.marker-motion')) expect(motion.text()).toBe('')
      wrapper.unmount()
    })

    it('rotates the shortest way across north and clears indicators when data disappears', async () => {
      const wrapper = await mountWithMarkers([
        { name: 'mover', latitude: 1, longitude: 2, timestamp: fresh(), speed: 10, heading: 350 },
      ])
      const { orbit, label } = markerElement(wrapper)
      expect(orbit.style.transform).toBe('rotate(-10deg)')

      markerService.markers.value = [
        { name: 'mover', latitude: 1.1, longitude: 2, timestamp: fresh(), speed: 10, heading: 10 },
      ]
      await nextTick()
      // Same DOM node is updated in place
      expect(markerElement(wrapper).orbit).toBe(orbit)
      expect(orbit.style.transform).toBe('rotate(10deg)')

      markerService.markers.value = [
        { name: 'mover', latitude: 1.2, longitude: 2, timestamp: fresh(), speed: 10, heading: 350 },
      ]
      await nextTick()
      expect(orbit.style.transform).toBe('rotate(-10deg)')

      markerService.markers.value = [
        { name: 'mover', latitude: 1.3, longitude: 2, timestamp: fresh() },
      ]
      await nextTick()
      expect(orbit.hidden).toBe(true)
      expect(label.hidden).toBe(true)
      wrapper.unmount()
    })

    it('only re-lays out an open popup when its text changes', async () => {
      const timestamp = fresh()
      const data = { name: 'mover', latitude: 1, longitude: 2, timestamp, speed: 10, heading: 90 }
      const wrapper = await mountWithMarkers([data])
      await wrapper.find('.stalk-marker-icon').trigger('click')
      const update = vi.spyOn(L.Popup.prototype, 'update')

      // Same text (e.g. a new position) must not re-run autopan
      markerService.markers.value = [{ ...data, latitude: 1.1 }]
      await nextTick()
      expect(update).not.toHaveBeenCalled()

      markerService.markers.value = [{ ...data, latitude: 1.2, speed: 20 }]
      await nextTick()
      expect(update).toHaveBeenCalled()
      update.mockRestore()
      wrapper.unmount()
    })

    it('keeps the GitHub avatar for kazie', async () => {
      const wrapper = await mountWithMarkers([
        { name: 'kazie', latitude: 1, longitude: 2, timestamp: fresh() },
        { name: '<b>x</b>', latitude: 3, longitude: 4, timestamp: fresh() },
      ])

      const kazie = markerElement(wrapper, 0).avatar
      expect(kazie.src).toBe('https://avatars.githubusercontent.com/u/1390887')
      expect(kazie.classList.contains('rounded-icon')).toBe(true)
      const other = markerElement(wrapper, 1).avatar
      expect(other.src).toContain('https://ui-avatars.com/api/')
      expect(other.classList.contains('rounded-icon')).toBe(false)

      // Names are escaped in the popup HTML
      await wrapper.findAll('.stalk-marker-icon')[1]!.trigger('click')
      const popup = wrapper.find('.leaflet-popup-content')
      expect(popup.find('b').text()).toBe('<b>x</b>')
      wrapper.unmount()
    })
  })

  describe('navigation', () => {
    it('should navigate to user page when navigateTo is called with a name', async () => {
      // Reset the mock before the test
      mockRouterPush.mockReset()

      const wrapper = mount(MapComponent)

      // Call the navigateTo method with a name
      await wrapper.vm.navigateTo('test')

      expect(mockRouterPush).toHaveBeenCalledWith('/test')
    })

    it('should navigate to home page when navigateTo is called with null', async () => {
      // Reset the mock before the test
      mockRouterPush.mockReset()

      const wrapper = mount(MapComponent)

      // Call the navigateTo method with null
      await wrapper.vm.navigateTo(null)

      expect(mockRouterPush).toHaveBeenCalledWith('/')
    })
  })
})
