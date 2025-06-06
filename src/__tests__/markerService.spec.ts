import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  currentName,
  error,
  fetchMarkerByName,
  fetchMarkerData,
  freeRoamingMode,
  isLoading,
  markers,
  setUpdateFrequency,
  startFetching,
  startFetchingByName,
  stopFetching,
  toggleFreeRoamingMode,
  updateFrequency,
  currentZoomLevel,
  setZoomLevel,
  ZoomLevel,
} from '../services/markerService'

// Mock fetch API
global.fetch = vi.fn()

// Mock setInterval and clearInterval
vi.stubGlobal(
  'setInterval',
  vi.fn(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
)
vi.stubGlobal('clearInterval', vi.fn())

describe('markerService', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks()

    // Reset reactive state
    markers.value = []
    isLoading.value = false
    error.value = null
    currentName.value = null
    freeRoamingMode.value = false
    updateFrequency.value = 5000
    currentZoomLevel.value = ZoomLevel.Medium

    // Mock successful fetch response
    const mockResponse = {
      ok: true,
      json: vi
        .fn()
        .mockResolvedValue([
          { name: 'test', latitude: 1, longitude: 1, timestamp: '2023-01-01T00:00:00Z' },
        ]),
    }

    // @ts-ignore - TypeScript doesn't know we're mocking fetch
    global.fetch.mockResolvedValue(mockResponse)
  })

  afterEach(() => {
    // Clean up after each test
    vi.restoreAllMocks()
  })

  describe('fetchMarkerData', () => {
    it('should fetch marker data from the API', async () => {
      await fetchMarkerData()

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(markers.value.length).toBe(1)
      expect(isLoading.value).toBe(false)
      expect(error.value).toBe(null)
    })

    it('should handle API errors', async () => {
      // Mock a failed response
      // @ts-ignore - TypeScript doesn't know we're mocking fetch
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      await fetchMarkerData()

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(error.value).not.toBe(null)
      expect(isLoading.value).toBe(false)
    })
  })

  describe('fetchMarkerByName', () => {
    it('should fetch marker data for a specific name', async () => {
      await fetchMarkerByName('test')

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/test'))
      expect(markers.value.length).toBe(1)
      expect(currentName.value).toBe('test')
      expect(isLoading.value).toBe(false)
      expect(error.value).toBe(null)
    })

    it('should handle API errors', async () => {
      // Mock a failed response
      // @ts-ignore - TypeScript doesn't know we're mocking fetch
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      await fetchMarkerByName('nonexistent')

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(error.value).toBe('No user named "nonexistent" known...')
      expect(markers.value.length).toBe(0)
      expect(isLoading.value).toBe(false)
    })
  })

  describe('startFetching', () => {
    it('should fetch data initially and set up an interval', async () => {
      await startFetching()

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(setInterval).toHaveBeenCalledTimes(1)
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000)
    })

    it('should use the provided interval', async () => {
      await startFetching(5000)

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000)
    })
  })

  describe('startFetchingByName', () => {
    it('should fetch data for a specific name initially and set up an interval', async () => {
      await startFetchingByName('test')

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/test'))
      expect(setInterval).toHaveBeenCalledTimes(1)
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000)
    })

    it('should use the provided interval', async () => {
      await startFetchingByName('test', 5000)

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000)
    })
  })

  describe('stopFetching', () => {
    it('should clear the interval', async () => {
      // Set up an interval first
      await startFetching()

      // Then stop it
      stopFetching()

      // Called on start, and once in test
      expect(clearInterval).toHaveBeenCalledTimes(2)
    })

    it('should do nothing if no interval is set', () => {
      // Call stopFetching without setting up an interval first
      stopFetching()

      expect(clearInterval).not.toHaveBeenCalledTimes(1)
    })
  })

  describe('toggleFreeRoamingMode', () => {
    it('should toggle the free roaming mode', () => {
      // Initial state should be false
      expect(freeRoamingMode.value).toBe(false)

      // Toggle it on
      toggleFreeRoamingMode()
      expect(freeRoamingMode.value).toBe(true)

      // Toggle it off
      toggleFreeRoamingMode()
      expect(freeRoamingMode.value).toBe(false)
    })
  })

  describe('setUpdateFrequency', () => {
    it('should set the update frequency', () => {
      // Initial state should be 5000
      expect(updateFrequency.value).toBe(5000)

      // Set a new frequency
      setUpdateFrequency(1000)
      expect(updateFrequency.value).toBe(1000)
    })

    it('should update the frequency value', async () => {
      // Initial value should be 5000
      expect(updateFrequency.value).toBe(5000)

      // Set a new frequency
      await setUpdateFrequency(1000)

      // Should update the frequency value
      expect(updateFrequency.value).toBe(1000)
    })

    it('should work with different frequency values', async () => {
      // Set a different frequency
      await setUpdateFrequency(2000)
      expect(updateFrequency.value).toBe(2000)

      // Set another frequency
      await setUpdateFrequency(30000)
      expect(updateFrequency.value).toBe(30000)

      // Set back to default
      await setUpdateFrequency(5000)
      expect(updateFrequency.value).toBe(5000)
    })
  })

  describe('setZoomLevel', () => {
    it('should set the zoom level', () => {
      // Initial state should be Medium (15)
      expect(currentZoomLevel.value).toBe(ZoomLevel.Medium)

      // Set a new zoom level
      setZoomLevel(ZoomLevel.Close)
      expect(currentZoomLevel.value).toBe(ZoomLevel.Close)
    })

    it('should work with different zoom levels', () => {
      // Set to Close
      setZoomLevel(ZoomLevel.Close)
      expect(currentZoomLevel.value).toBe(ZoomLevel.Close)

      // Set to Far
      setZoomLevel(ZoomLevel.Far)
      expect(currentZoomLevel.value).toBe(ZoomLevel.Far)

      // Set to Very Far
      setZoomLevel(ZoomLevel.VeryFar)
      expect(currentZoomLevel.value).toBe(ZoomLevel.VeryFar)

      // Set back to Medium
      setZoomLevel(ZoomLevel.Medium)
      expect(currentZoomLevel.value).toBe(ZoomLevel.Medium)
    })
  })
})
