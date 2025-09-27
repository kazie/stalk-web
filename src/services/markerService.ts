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

// Define zoom level options
export enum ZoomLevel {
  Close = 18,
  Medium = 15,
  Far = 10,
  VeryFar = 6,
  CountryFar = 4,
}

// Create reactive state for the free roaming mode, update frequency, and zoom level
export const freeRoamingMode = ref(false)
export const updateFrequency = ref(5000) // Default to 5 seconds
export const currentZoomLevel = ref<ZoomLevel>(ZoomLevel.Medium) // Default to medium zoom

// Update mode options: Poll (HTTP polling) or Live (WebSocket)
export enum UpdateMode {
  Poll = 'poll',
  Live = 'live',
}

export const updateMode = ref<UpdateMode>(UpdateMode.Live)
export const setUpdateMode = (mode: UpdateMode): void => {
  updateMode.value = mode
}

// WebSocket state
let ws: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
let wsIntentionallyClosed = false

const buildWsUrl = (name?: string): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host
  const path = name ? `/ws/coords/${encodeURIComponent(name)}` : '/ws/coords?initial=1'
  return `${protocol}://${host}${path}`
}

const applyMarkerUpdate = (m: MarkerData) => {
  if (currentName.value) {
    // Single user view
    markers.value = [m]
    return
  }
  // All users: keep latest per user
  const idx = markers.value.findIndex((x) => x.name === m.name)
  if (idx >= 0) markers.value.splice(idx, 1, m)
  else markers.value.push(m)
}

const connectWs = (name?: string) => {
  // Cleanup any existing connection
  if (ws) {
    try {
      wsIntentionallyClosed = true
      ws.close()
    } catch (e) {
      // ignore
    } finally {
      ws = null
    }
  }
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }

  isLoading.value = true
  error.value = null
  wsIntentionallyClosed = false

  const url = buildWsUrl(name)
  ws = new WebSocket(url)

  ws.onopen = () => {
    isLoading.value = false
  }

  ws.onmessage = (evt: MessageEvent) => {
    try {
      const data = JSON.parse(evt.data as string) as MarkerData
      applyMarkerUpdate(data)
    } catch (e) {
      console.error('WS message parse error', e)
    }
  }

  ws.onerror = (evt: Event) => {
    console.error('WebSocket error', evt)
  }

  ws.onclose = () => {
    ws = null
    if (!wsIntentionallyClosed && updateMode.value === UpdateMode.Live) {
      // simple reconnect after 1s
      wsReconnectTimer = setTimeout(() => connectWs(name), 1000)
    }
  }
}

export const startLive = (): void => {
  // Live mode for all users
  currentName.value = null
  connectWs()
}

export const startLiveByName = (name: string): void => {
  currentName.value = name
  connectWs(name)
}

export const stopLive = (): void => {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }
  if (ws) {
    wsIntentionallyClosed = true
    try {
      ws.close()
    } catch (e) {
      // ignore
    }
    ws = null
  }
}

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

// Set zoom level
export const setZoomLevel = (zoomLevel: ZoomLevel): void => {
  currentZoomLevel.value = zoomLevel
}

// Stop periodic fetching
export const stopFetching = (): void => {
  if (fetchInterval) {
    clearInterval(fetchInterval)
    fetchInterval = null
  }
}

// Stop all updates (polling and live)
export const stopUpdates = (): void => {
  try {
    stopFetching()
  } catch (e) {
    // ignore
  }
  try {
    stopLive()
  } catch (e) {
    // ignore
  }
}
