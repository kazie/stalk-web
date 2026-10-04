import { onMounted, onUnmounted, ref, watch } from 'vue'
import {
  GPUInitializationError,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { parseISO } from 'date-fns'
import { currentZoomLevel, freeRoamingMode, markers, ZoomLevel } from '@/services/markerService'
import { getRelativeTime } from '@/services/timeTool'
import { addStyleSwitcher } from './mapStyles'

// MapLibre resolves its worker next to its own module, which Vite neither serves nor emits.
setWorkerUrl(workerUrl)

// The popup is built once; each tick only rewrites its time text.
type MarkerRecord = { marker: Marker; timestamp: string; timeText: Text }

const buildAvatarUrl = (name: string): string => {
  const url = new URL('https://ui-avatars.com/api/')
  url.search = new URLSearchParams({
    name,
    background: 'random',
    format: 'svg',
    rounded: 'true',
  }).toString()
  return url.toString()
}

const createAvatar = (name: string): HTMLImageElement => {
  const avatar = document.createElement('img')
  avatar.width = avatar.height = 50
  avatar.alt = name
  if (name.toLowerCase() === 'kazie') {
    avatar.src = 'https://avatars.githubusercontent.com/u/1390887'
    avatar.className = 'rounded-icon'
  } else {
    avatar.src = buildAvatarUrl(name)
  }
  return avatar
}

const createMarker = (name: string, timestamp: string): MarkerRecord => {
  const bold = document.createElement('b')
  bold.textContent = name
  const timeText = document.createTextNode('')
  const content = document.createElement('span')
  content.append(bold, ' ', timeText)
  const marker = new Marker({ element: createAvatar(name) }).setPopup(
    new Popup({ offset: 25 }).setDOMContent(content),
  )
  return { marker, timestamp, timeText }
}

export const useMapMarkers = () => {
  const mapContainer = ref<HTMLElement | null>(null)
  const mapError = ref<string | null>(null)
  let autoEnforcedFreeRoaming = false
  let map: MapLibreMap | null = null
  const markerByName = new Map<string, MarkerRecord>()
  let popupUpdateTimer: ReturnType<typeof setTimeout> | null = null

  const refreshPopups = (): void => {
    for (const record of markerByName.values()) {
      record.timeText.data = getRelativeTime(record.timestamp)
    }
  }

  const computeNextDelayMs = (): number => {
    const now = Date.now()
    for (const record of markerByName.values()) {
      const ageMs = now - parseISO(record.timestamp).getTime()
      if (ageMs < 60_000) return 1000
    }
    return Math.max(500, 60_000 - (now % 60_000))
  }

  const scheduleAdaptiveTick = (): void => {
    if (popupUpdateTimer) clearTimeout(popupUpdateTimer)
    popupUpdateTimer = setTimeout(() => {
      refreshPopups()
      scheduleAdaptiveTick()
    }, computeNextDelayMs())
  }

  const updateMapMarkers = (): void => {
    if (!map) return

    if (markers.value.length === 0) {
      if (!freeRoamingMode.value) {
        freeRoamingMode.value = true
        autoEnforcedFreeRoaming = true
      }
    } else if (autoEnforcedFreeRoaming && freeRoamingMode.value) {
      freeRoamingMode.value = false
      autoEnforcedFreeRoaming = false
    }

    const bounds = new LngLatBounds()
    const incomingNames = new Set<string>()

    for (const { name, latitude, longitude, timestamp } of markers.value) {
      incomingNames.add(name)
      const position: [number, number] = [longitude, latitude]
      bounds.extend(position)

      const existing = markerByName.get(name)
      if (existing) {
        existing.marker.setLngLat(position)
        existing.timestamp = timestamp
      } else {
        const record = createMarker(name, timestamp)
        // MapLibre needs the position before the marker joins the map.
        record.marker.setLngLat(position).addTo(map)
        markerByName.set(name, record)
      }
    }

    for (const [name, record] of markerByName.entries()) {
      if (!incomingNames.has(name)) {
        record.marker.remove()
        markerByName.delete(name)
      }
    }

    const [only, ...others] = markers.value
    if (only && !freeRoamingMode.value) {
      if (others.length === 0)
        map.easeTo({ center: [only.longitude, only.latitude], zoom: currentZoomLevel.value })
      // Keep the user's rotation, and don't zoom past the tiles' detail for markers close together.
      else
        map.fitBounds(bounds, {
          padding: 50,
          bearing: map.getBearing(),
          maxZoom: ZoomLevel.Close,
        })
    }
    refreshPopups()
    // New markers may need a faster tick than the one already scheduled.
    scheduleAdaptiveTick()
  }

  watch(markers, updateMapMarkers, { deep: true })

  const createMap = (container: HTMLElement): MapLibreMap | null => {
    try {
      return new MapLibreMap({ container, center: [15, 62], zoom: ZoomLevel.CountryFar })
    } catch (error) {
      if (!(error instanceof GPUInitializationError)) throw error
      console.error(error)
      mapError.value =
        "The map can't be shown because your browser doesn't support WebGL 2. The list of people still works."
      return null
    }
  }

  onMounted(() => {
    if (!mapContainer.value) return
    map = createMap(mapContainer.value)
    if (!map) return

    // Zoom buttons plus a compass that shows the tilt; clicking it resets to north-up and flat.
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-left')
    addStyleSwitcher(map)

    // Markers may have arrived before the map was created. Fit again once loaded, as the
    // container may only have its final size by then; MapLibre tracks later resizes itself.
    updateMapMarkers()
    map.once('load', updateMapMarkers)
  })

  onUnmounted(() => {
    if (popupUpdateTimer) clearTimeout(popupUpdateTimer)
    map?.remove()
    map = null
  })

  return { mapContainer, mapError }
}
