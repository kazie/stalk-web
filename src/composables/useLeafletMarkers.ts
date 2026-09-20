import { onMounted, onUnmounted, ref, watch } from 'vue'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { parseISO } from 'date-fns'
import {
  currentZoomLevel,
  freeRoamingMode,
  markers,
  ZoomLevel,
  type MarkerData,
} from '@/services/markerService'
import { getRelativeTime } from '@/services/timeTool'

type MarkerRecord = { marker: L.Marker; name: string; timestamp: string }

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

const getIconForName = (name: string): L.Icon => {
  if (name.toLowerCase() === 'kazie') {
    return L.icon({
      className: 'rounded-icon',
      iconUrl: 'https://avatars.githubusercontent.com/u/1390887',
      iconSize: [50, 50],
      iconAnchor: [25, 25],
      popupAnchor: [0, -25],
    })
  }

  return L.icon({
    iconUrl: buildAvatarUrl(name),
    iconSize: [50, 50],
    iconAnchor: [25, 25],
    popupAnchor: [0, -25],
  })
}

export const useLeafletMarkers = () => {
  const mapContainer = ref<HTMLElement | null>(null)
  const autoEnforcedFreeRoaming = ref(false)
  let map: L.Map | null = null
  let markersLayer: L.LayerGroup | null = null
  let markerInstances: MarkerRecord[] = []
  const markerByName = new Map<string, MarkerRecord>()
  const nowTick = ref(Date.now())
  let popupUpdateTimer: ReturnType<typeof setTimeout> | null = null
  let resizeObserver: ResizeObserver | null = null
  let initialRefreshTimer: ReturnType<typeof setTimeout> | null = null

  const relativeTime = (timestamp: string): string => {
    nowTick.value
    return getRelativeTime(timestamp)
  }

  const refreshRelativeTimesAndPopups = (): void => {
    nowTick.value = Date.now()
    for (const item of markerInstances) {
      const html = `<b>${item.name}</b> ${getRelativeTime(item.timestamp)}`
      const popup = item.marker.getPopup()
      if (popup) item.marker.setPopupContent(html)
      else item.marker.bindPopup(html)
    }
  }

  const computeNextDelayMs = (): number => {
    const now = Date.now()
    for (const item of markerInstances) {
      const ageMs = now - parseISO(item.timestamp).getTime()
      if (ageMs < 60_000) return 1000
    }
    return Math.max(500, 60_000 - (now % 60_000))
  }

  const scheduleAdaptiveTick = (): void => {
    if (popupUpdateTimer) clearTimeout(popupUpdateTimer)
    popupUpdateTimer = setTimeout(() => {
      refreshRelativeTimesAndPopups()
      scheduleAdaptiveTick()
    }, computeNextDelayMs())
  }

  const clearMarkers = (): void => {
    if (!markersLayer) return
    for (const record of markerByName.values()) markersLayer.removeLayer(record.marker)
    markerByName.clear()
    markerInstances = []
  }

  const updateMapMarkers = (): void => {
    if (!map) return
    if (!markersLayer) markersLayer = L.layerGroup().addTo(map)

    if (markers.value.length === 0) {
      clearMarkers()
      if (!freeRoamingMode.value) {
        freeRoamingMode.value = true
        autoEnforcedFreeRoaming.value = true
      }
      refreshRelativeTimesAndPopups()
      return
    }

    if (autoEnforcedFreeRoaming.value && freeRoamingMode.value) {
      freeRoamingMode.value = false
      autoEnforcedFreeRoaming.value = false
    }

    const bounds = L.latLngBounds([])
    const incomingNames = new Set<string>()

    for (const markerData of markers.value) {
      incomingNames.add(markerData.name)
      const position = L.latLng(markerData.latitude, markerData.longitude)
      bounds.extend(position)

      const existing = markerByName.get(markerData.name)
      if (existing) {
        existing.marker.setLatLng(position)
        existing.timestamp = markerData.timestamp

        const popup = existing.marker.getPopup()
        // @ts-ignore Leaflet version compatibility guard
        const isOpen =
          typeof (existing.marker as any).isPopupOpen === 'function'
            ? (existing.marker as any).isPopupOpen()
            : !!(popup as any)?.isOpen?.()
        if (isOpen) {
          const html = `<b>${markerData.name}</b> ${getRelativeTime(markerData.timestamp)}`
          if (popup) existing.marker.setPopupContent(html)
          else existing.marker.bindPopup(html)
        }
      } else {
        const marker = L.marker(position, { icon: getIconForName(markerData.name) }).addTo(
          markersLayer!,
        )
        marker.bindPopup(`<b>${markerData.name}</b> ${getRelativeTime(markerData.timestamp)}`)
        markerByName.set(markerData.name, {
          marker,
          name: markerData.name,
          timestamp: markerData.timestamp,
        })
      }
    }

    for (const [name, record] of markerByName.entries()) {
      if (!incomingNames.has(name)) {
        markersLayer.removeLayer(record.marker)
        markerByName.delete(name)
      }
    }

    markerInstances = Array.from(markerByName.values())
    if (!freeRoamingMode.value) {
      if (markers.value.length === 1) {
        const marker = markers.value[0]
        if (marker)
          map.setView([marker.latitude, marker.longitude], currentZoomLevel.value, {
            animate: true,
          })
      } else if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], animate: true })
      }
    }
    refreshRelativeTimesAndPopups()
  }

  watch(markers, updateMapMarkers, { deep: true })

  onMounted(() => {
    if (mapContainer.value) {
      map = L.map(mapContainer.value).setView([62, 15], 4)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      // Markers may have arrived before Leaflet finished mounting.
      updateMapMarkers()

      // Recalculate Leaflet's dimensions after flex/container layout settles.
      initialRefreshTimer = setTimeout(() => {
        map?.invalidateSize()
        updateMapMarkers()
        initialRefreshTimer = null
      }, 100)

      resizeObserver = new ResizeObserver(() => map?.invalidateSize())
      resizeObserver.observe(mapContainer.value)
    }
    scheduleAdaptiveTick()
  })

  onUnmounted(() => {
    if (initialRefreshTimer) clearTimeout(initialRefreshTimer)
    if (popupUpdateTimer) clearTimeout(popupUpdateTimer)
    resizeObserver?.disconnect()
    resizeObserver = null
    if (map) map.remove()
    map = null
  })

  return { mapContainer, relativeTime }
}
