import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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
