import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  markers,
  isLoading,
  error,
  fetchMarkerData,
  startFetching,
  stopFetching,
  freeRoamingMode,
  updateFrequency,
  toggleFreeRoamingMode,
  setUpdateFrequency,
} from '../markerService'

// Mock the fetch API
global.fetch = vi.fn()

describe('markerService', () => {
  beforeEach(() => {
    // Reset the state before each test
    markers.value = []
    isLoading.value = false
    error.value = null
    freeRoamingMode.value = false
    updateFrequency.value = 5000

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clear any intervals that might have been set
    vi.restoreAllMocks()
  })

  it('fetches marker data successfully', async () => {
    // Mock a successful API response
    const mockData = [
      { name: 'Test Marker 1', latitude: 40.7128, longitude: -74.006 },
      { name: 'Test Marker 2', latitude: 51.5074, longitude: -0.1278 },
    ]

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    })

    // Call the fetch function
    await fetchMarkerData()

    // Check that fetch was called with the correct URL
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String))

    // Check that the state was updated correctly
    expect(markers.value).toEqual(mockData)
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('handles API errors', async () => {
    // Mock a failed API response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    // Call the fetch function
    await fetchMarkerData()

    // Check that the state was updated correctly
    expect(markers.value).toEqual([])
    expect(isLoading.value).toBe(false)
    expect(error.value).toBe('API request failed with status 404')
  })

  it('handles network errors', async () => {
    // Mock a network error
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

    // Call the fetch function
    await fetchMarkerData()

    // Check that the state was updated correctly
    expect(markers.value).toEqual([])
    expect(isLoading.value).toBe(false)
    expect(error.value).toBe('Network error')
  })

  it('starts and stops periodic fetching', async () => {
    // Mock the global functions
    const originalSetInterval = global.setInterval
    const originalClearInterval = global.clearInterval

    // Create a fake interval ID
    const fakeIntervalId = 12345

    // Replace setInterval with a mock that returns the fake ID
    global.setInterval = vi.fn().mockReturnValue(fakeIntervalId)

    // Replace clearInterval with a mock
    global.clearInterval = vi.fn()

    try {
      // Call the functions we want to test
      await startFetching()

      // Verify that setInterval was called with the correct interval
      expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 5000)

      // At this point, setInterval has been called with fetchMarkerData as the callback

      // Now stop fetching
      stopFetching()

      // Verify that clearInterval was called with the correct interval ID
      expect(global.clearInterval).toHaveBeenCalledWith(fakeIntervalId)
    } finally {
      // Restore the original functions
      global.setInterval = originalSetInterval
      global.clearInterval = originalClearInterval
    }
  })

  it('toggles free roaming mode', () => {
    // Initial state should be false
    expect(freeRoamingMode.value).toBe(false)

    // Toggle it on
    toggleFreeRoamingMode()
    expect(freeRoamingMode.value).toBe(true)

    // Toggle it off
    toggleFreeRoamingMode()
    expect(freeRoamingMode.value).toBe(false)
  })

  it('sets update frequency', async () => {
    // Initial state should be 5000
    expect(updateFrequency.value).toBe(5000)

    // Set a new frequency
    await setUpdateFrequency(1000)
    expect(updateFrequency.value).toBe(1000)

    // Set another frequency
    await setUpdateFrequency(2000)
    expect(updateFrequency.value).toBe(2000)

    // Set back to default
    await setUpdateFrequency(5000)
    expect(updateFrequency.value).toBe(5000)
  })
})
