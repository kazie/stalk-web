import { ref } from 'vue'

// Define the type for marker data
export interface MarkerData {
  name: string
  latitude: number
  longitude: number
  timestamp: string
}

// Get the API endpoint from environment variables
const apiEndpoint = import.meta.env.VITE_API_ENDPOINT as string

// Create reactive state for the markers data
export const markers = ref<MarkerData[]>([])
export const isLoading = ref(false)
export const error = ref<string | null>(null)
export const currentName = ref<string | null>(null)

// Create reactive state for the free roaming mode and update frequency
export const freeRoamingMode = ref(false)
export const updateFrequency = ref(5000) // Default to 5 seconds

// Fetch marker data from the API
export const fetchMarkerData = async (): Promise<void> => {
  isLoading.value = true
  error.value = null

  try {
    const response = await fetch(apiEndpoint)

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    const data = await response.json()
    markers.value = data
  } catch (err) {
    console.error('Error fetching marker data:', err)
    error.value = err instanceof Error ? err.message : 'Unknown error occurred'
  } finally {
    isLoading.value = false
  }
}

// Fetch marker data for a specific name
export const fetchMarkerByName = async (name: string): Promise<void> => {
  isLoading.value = true
  error.value = null
  currentName.value = name

  try {
    const response = await fetch(`${apiEndpoint}/${name}`)

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`No user named "${name}" known...`)
      }
      throw new Error(`API request failed with status ${response.status}`)
    }

    const data = await response.json()
    // If the API returns a single object, wrap it in an array
    markers.value = Array.isArray(data) ? data : [data]
  } catch (err) {
    console.error(`Error fetching marker data for ${name}:`, err)
    error.value = err instanceof Error ? err.message : 'Unknown error occurred'
    markers.value = [] // Clear markers on error
  } finally {
    isLoading.value = false
  }
}

// Set up periodic data fetching
let fetchInterval: ReturnType<typeof setTimeout> | null = null

// Start periodic fetching for all markers
export const startFetching = async (intervalMs?: number): Promise<void> => {
  stopFetching()
  // Initial fetch
  await fetchMarkerData()

  // Set up interval for periodic fetching using the provided interval or the reactive updateFrequency
  const interval = intervalMs || updateFrequency.value
  fetchInterval = setInterval(fetchMarkerData, interval)
}

// Start periodic fetching for a specific name
export const startFetchingByName = async (name: string, intervalMs?: number): Promise<void> => {
  stopFetching()
  // Initial fetch
  await fetchMarkerByName(name)

  // Set up interval for periodic fetching using the provided interval or the reactive updateFrequency
  const interval = intervalMs || updateFrequency.value
  fetchInterval = setInterval(async () => await fetchMarkerByName(name), interval)
}

// Toggle free roaming mode
export const toggleFreeRoamingMode = (): void => {
  freeRoamingMode.value = !freeRoamingMode.value
}

// Set update frequency and restart fetching if active
export const setUpdateFrequency = async (frequencyMs: number): Promise<void> => {
  updateFrequency.value = frequencyMs

  // If we have an active interval, restart it with the new frequency
  if (fetchInterval) {
    try {
      if (currentName.value) {
        await startFetchingByName(currentName.value)
      } else {
        await startFetching()
      }
    } catch (error) {
      console.error('Error restarting fetch after frequency update:', error)
    }
  }
}

// Stop periodic fetching
export const stopFetching = (): void => {
  if (fetchInterval) {
    clearInterval(fetchInterval)
    fetchInterval = null
  }
}
