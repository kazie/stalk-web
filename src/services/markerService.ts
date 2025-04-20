import { ref } from 'vue'

// Define the type for marker data
export interface MarkerData {
  name: string
  latitude: number
  longitude: number
}

// Get the API endpoint from environment variables
const apiEndpoint = import.meta.env.VITE_API_ENDPOINT as string

// Create reactive state for the markers data
export const markers = ref<MarkerData[]>([])
export const isLoading = ref(false)
export const error = ref<string | null>(null)

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

// Set up periodic data fetching
let fetchInterval: number | null = null

// Start periodic fetching
export const startFetching = (intervalMs = 30000): void => {
  // Initial fetch
  fetchMarkerData()

  // Set up interval for periodic fetching
  fetchInterval = setInterval(fetchMarkerData, intervalMs) as unknown as number
}

// Stop periodic fetching
export const stopFetching = (): void => {
  if (fetchInterval !== null) {
    clearInterval(fetchInterval)
    fetchInterval = null
  }
}
