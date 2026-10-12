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
import L from 'leaflet'
import { hasMotionData, normalizeDegrees } from '../services/motion'

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
}

export const SAMPLE_MARKERS: MarkerData[] = [
  {
    name: 'kazie',
    latitude: 59.3293,
    longitude: 18.0686,
    timestamp: new Date().toISOString(),
    // Moving: triangle + speed label
    speed: 8.9,
    heading: 45,
  },
  {
    name: 'kaichan',
    latitude: 35.6762,
    longitude: 139.6503,
    timestamp: new Date(Date.now() - 10 * 1000).toISOString(),
    // Stationary: speed label only
    speed: 0,
  },
  {
    name: 'Alice',
    latitude: 40.7128,
    longitude: -74.006,
    timestamp: new Date(Date.now() - 120 * 1000).toISOString(),
    // Stale fix: motion data is ignored
    speed: 20,
    heading: 270,
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
    speed: 1.4,
    heading: 350,
  },
  {
    name: 'Slussen Tracker',
    latitude: 59.3197,
    longitude: 18.0715,
    timestamp: new Date(Date.now() - 20 * 1000).toISOString(),
    // Below the moving threshold: GPS bearing is noise, so no triangle
    speed: 0.3,
    heading: 120,
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

// Speed (m/s) and approximate heading (degrees from north) between two nearby points
const motionBetween = (
  from: MarkerData,
  to: Pick<MarkerData, 'latitude' | 'longitude'>,
  elapsedMs: number,
): { speed: number; heading: number } => {
  const distanceM = L.latLng(from.latitude, from.longitude).distanceTo([to.latitude, to.longitude])
  const speed = distanceM / (elapsedMs / 1000)
  const north = to.latitude - from.latitude
  const east = (to.longitude - from.longitude) * Math.cos((from.latitude * Math.PI) / 180)
  const heading = normalizeDegrees((Math.atan2(east, north) * 180) / Math.PI)
  return { speed, heading }
}

export function setupMockEnvironment(options: MockScenarioOptions = {}): () => void {
  const originalFetch = window.fetch
  const originalWebSocket = window.WebSocket

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

  // Mock Fetch. Errors use the API's RFC 9457 problem+json format
  const problem = (status: number, title: string, detail: string, instance: string) =>
    new Response(JSON.stringify({ type: 'about:blank', title, status, detail, instance }), {
      status,
      headers: { 'Content-Type': 'application/problem+json' },
    })

  window.fetch = async (input: RequestInfo | URL) => {
    const urlStr = typeof input === 'string' ? input : input.toString()
    if (options.error) {
      return problem(500, 'Internal Server Error', options.error, '/api/coords')
    }
    if (urlStr.includes('/api/coords/')) {
      const parts = urlStr.split('/api/coords/')
      const name = decodeURIComponent(parts[1] ?? '')
      const found = markers.value.find((m) => m.name.toLowerCase() === name.toLowerCase())
      if (!found) {
        return problem(404, 'Not Found', `No user named '${name}'`, `/api/coords/${parts[1]}`)
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
    const intervalMs = options.movementIntervalMs ?? 1500
    simulationTimer = setInterval(() => {
      step += 1
      markers.value = markers.value.map((m, i) => {
        const timestamp = new Date().toISOString()
        // Stationary targets stay put and keep reporting zero speed
        if (m.speed === 0) return { ...m, timestamp }

        const offset = step * 0.1 + i
        const deltaLat = Math.sin(offset) * 0.0005
        const deltaLng = Math.cos(offset) * 0.0005
        const next = {
          latitude: Number((m.latitude + deltaLat).toFixed(5)),
          longitude: Number((m.longitude + deltaLng).toFixed(5)),
        }
        // Targets without motion data simulate clients that don't report speed/heading
        return {
          ...m,
          ...next,
          ...(hasMotionData(m) ? motionBetween(m, next, intervalMs) : {}),
          timestamp,
        }
      })
    }, intervalMs)
  }

  return () => {
    if (simulationTimer) {
      clearInterval(simulationTimer)
      simulationTimer = null
    }
    window.fetch = originalFetch
    window.WebSocket = originalWebSocket
  }
}
