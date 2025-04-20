import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  markers,
  isLoading,
  error,
  fetchMarkerData,
  startFetching,
  stopFetching,
} from '../markerService'

// Mock the fetch API
global.fetch = vi.fn()

describe('markerService', () => {
  beforeEach(() => {
    // Reset the state before each test
    markers.value = []
    isLoading.value = false
    error.value = null

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

  it('starts and stops periodic fetching', () => {
    // Mock setInterval and clearInterval
    vi.spyOn(global, 'setInterval')
    vi.spyOn(global, 'clearInterval')

    // Mock fetchMarkerData
    vi.spyOn({ fetchMarkerData }, 'fetchMarkerData')

    // Start fetching
    startFetching(5000)

    // Check that fetchMarkerData was called and setInterval was set up
    expect(fetchMarkerData).toHaveBeenCalledTimes(1)
    expect(setInterval).toHaveBeenCalledWith(fetchMarkerData, 5000)

    // Stop fetching
    stopFetching()

    // Check that clearInterval was called
    expect(clearInterval).toHaveBeenCalledTimes(1)
  })
})
