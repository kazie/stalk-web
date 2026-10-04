import {
  markers,
  isLoading,
  error,
  currentName,
  freeRoamingMode,
  updateFrequency,
  currentZoomLevel,
  updateMode,
  ZoomLevel,
  UpdateMode,
  type MarkerData,
} from '../services/markerService'
import { elevationStorageKey, mapStyleStorageKey } from '../composables/mapStyles'

export interface MockScenarioOptions {
  initialMarkers?: MarkerData[]
  error?: string | null
  isLoading?: boolean
  currentName?: string | null
  simulateMovement?: boolean
  movementIntervalMs?: number
  freeRoaming?: boolean
  zoomLevel?: ZoomLevel
  mode?: UpdateMode
  /** Map style to start with, e.g. 'Vector: Liberty'. */
  mapStyle?: string
  /** Start with hill shading and 3D terrain on. */
  elevation?: boolean
  /** Act like a browser without WebGL, as on old devices. */
  noWebGL?: boolean
}

export const SAMPLE_MARKERS: MarkerData[] = [
  {
    name: 'kazie',
    latitude: 59.3293,
    longitude: 18.0686,
    timestamp: new Date().toISOString(),
  },
  {
    name: 'kaichan',
    latitude: 35.6762,
    longitude: 139.6503,
    timestamp: new Date(Date.now() - 45 * 1000).toISOString(),
  },
  {
    name: 'Alice',
    latitude: 40.7128,
    longitude: -74.006,
    timestamp: new Date(Date.now() - 120 * 1000).toISOString(),
  },
  {
    name: 'Bob',
    latitude: 51.5074,
    longitude: -0.1278,
    timestamp: new Date(Date.now() - 300 * 1000).toISOString(),
  },
  {
    name: 'Charlie',
    latitude: 48.8566,
    longitude: 2.3522,
    timestamp: new Date(Date.now() - 900 * 1000).toISOString(),
  },
  {
    name: 'Diana',
    latitude: -33.8688,
    longitude: 151.2093,
    timestamp: new Date(Date.now() - 1800 * 1000).toISOString(),
  },
]

export const CLUSTERED_MARKERS: MarkerData[] = [
  {
    name: 'kazie',
    latitude: 59.3293,
    longitude: 18.0686,
    timestamp: new Date().toISOString(),
  },
  {
    name: 'Gamla Stan Scout',
    latitude: 59.325,
    longitude: 18.0708,
    timestamp: new Date(Date.now() - 15 * 1000).toISOString(),
  },
  {
    name: 'Slussen Tracker',
    latitude: 59.3197,
    longitude: 18.0715,
    timestamp: new Date(Date.now() - 60 * 1000).toISOString(),
  },
  {
    name: 'Södermalm Rover',
    latitude: 59.3155,
    longitude: 18.074,
    timestamp: new Date(Date.now() - 180 * 1000).toISOString(),
  },
  {
    name: 'Central Station Unit',
    latitude: 59.3308,
    longitude: 18.0581,
    timestamp: new Date(Date.now() - 240 * 1000).toISOString(),
  },
]

// Around Zermatt and the Matterhorn, to show off the elevation layers.
export const MOUNTAIN_MARKERS: MarkerData[] = [
  {
    name: 'kazie',
    latitude: 45.9763,
    longitude: 7.6586,
    timestamp: new Date().toISOString(),
  },
  {
    name: 'Hiker',
    latitude: 46.0207,
    longitude: 7.7491,
    timestamp: new Date(Date.now() - 600 * 1000).toISOString(),
  },
  {
    name: 'Skier',
    latitude: 45.9387,
    longitude: 7.7297,
    timestamp: new Date(Date.now() - 90 * 1000).toISOString(),
  },
]

export function setupMockEnvironment(options: MockScenarioOptions = {}): () => void {
  const originalFetch = window.fetch
  const originalWebSocket = window.WebSocket
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  const originalGetItem = Storage.prototype.getItem
  const originalSetItem = Storage.prototype.setItem

  // The story's map settings live in memory, so they never leak into other stories or the real app.
  const storySettings = new Map<string, string>()
  if (options.mapStyle) storySettings.set(mapStyleStorageKey, options.mapStyle)
  if (options.elevation !== undefined)
    storySettings.set(elevationStorageKey, String(options.elevation))
  if (storySettings.size) {
    Storage.prototype.getItem = function (this: Storage, key: string) {
      return storySettings.get(key) ?? originalGetItem.call(this, key)
    }
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (storySettings.has(key)) storySettings.set(key, value)
      else originalSetItem.call(this, key, value)
    }
  }
  if (options.noWebGL) {
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === 'webgl2' || type === 'webgl') return null
      return (originalGetContext as (...args: unknown[]) => unknown).call(this, type, ...rest)
    } as typeof originalGetContext
  }

  const initial = options.initialMarkers ?? SAMPLE_MARKERS
  let currentMarkers = JSON.parse(JSON.stringify(initial)) as MarkerData[]

  if (options.currentName) {
    const single = currentMarkers.find(
      (m) => m.name.toLowerCase() === options.currentName?.toLowerCase(),
    )
    currentMarkers = single ? [single] : currentMarkers
  }

  markers.value = currentMarkers
  isLoading.value = options.isLoading ?? false
  error.value = options.error ?? null
  currentName.value = options.currentName ?? null
  freeRoamingMode.value = options.freeRoaming ?? false
  if (options.zoomLevel) currentZoomLevel.value = options.zoomLevel
  if (options.mode) updateMode.value = options.mode

  // Mock Fetch
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = input instanceof Request ? input.url : input.toString()
    // Only the app's own API is mocked; everything else, like map styles and tiles, is real.
    const url = new URL(urlStr, window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return originalFetch(input, init)
    }
    if (options.error) {
      return new Response(JSON.stringify({ error: options.error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (urlStr.includes('/api/coords/')) {
      const parts = urlStr.split('/api/coords/')
      const name = parts[1]
      const found = markers.value.find((m) => m.name.toLowerCase() === name?.toLowerCase())
      if (!found) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify(found), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify(markers.value), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Mock WebSocket
  class MockWebSocket {
    onopen: ((e: any) => void) | null = null
    onmessage: ((e: any) => void) | null = null
    onerror: ((e: any) => void) | null = null
    onclose: ((e: any) => void) | null = null
    readyState = 1
    constructor(public url: string) {
      setTimeout(() => {
        if (options.error) {
          this.onerror?.(new Event('error'))
          return
        }
        this.onopen?.(new Event('open'))
        if (currentMarkers && currentMarkers.length > 0) {
          for (const m of currentMarkers) {
            this.onmessage?.(
              new MessageEvent('message', { data: JSON.stringify({ type: 'update', ...m }) }),
            )
          }
        }
      }, 50)
    }
    send() {}
    close() {
      this.readyState = 3
      this.onclose?.(new CloseEvent('close'))
    }
  }

  // @ts-ignore
  window.WebSocket = MockWebSocket

  let simulationTimer: ReturnType<typeof setInterval> | null = null

  if (options.simulateMovement) {
    let step = 0
    simulationTimer = setInterval(() => {
      step += 1
      markers.value = markers.value.map((m, i) => {
        const offset = step * 0.1 + i
        const deltaLat = Math.sin(offset) * 0.0005
        const deltaLng = Math.cos(offset) * 0.0005
        return {
          ...m,
          latitude: Number((m.latitude + deltaLat).toFixed(5)),
          longitude: Number((m.longitude + deltaLng).toFixed(5)),
          timestamp: new Date().toISOString(),
        }
      })
    }, options.movementIntervalMs ?? 1500)
  }

  return () => {
    if (simulationTimer) {
      clearInterval(simulationTimer)
      simulationTimer = null
    }
    window.fetch = originalFetch
    window.WebSocket = originalWebSocket
    HTMLCanvasElement.prototype.getContext = originalGetContext
    Storage.prototype.getItem = originalGetItem
    Storage.prototype.setItem = originalSetItem
  }
}
