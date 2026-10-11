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
import { formatMotion, motionState, shortestRotation, type MotionState } from '@/services/motion'
import { getRelativeTime } from '@/services/timeTool'

type MarkerRecord = {
  marker: L.Marker
  data: MarkerData
  // data.timestamp parsed once, as epoch ms (NaN when unparseable)
  timestampMs: number
  // Last state written to the DOM, so ticks only touch what changed
  motion: MotionState | null
  // Cumulative orbit rotation in degrees, so CSS transitions take the shortest way round
  rotation: number
  orbit: HTMLElement
  speedLabel: HTMLElement
  popupTime: HTMLElement
  popupMotion: HTMLElement
}

type MarkerIcon = { icon: L.DivIcon; orbit: HTMLElement; speedLabel: HTMLElement }

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

const SVG_NS = 'http://www.w3.org/2000/svg'

// Avatar ball with a direction arrow orbiting just outside it and a speed label on its lower rim.
// Built as DOM nodes (not an HTML string) so names and URLs never need escaping, and so the
// orbit/label can be mutated in place later without re-creating the icon.
const buildMarkerIcon = (name: string): MarkerIcon => {
  const root = L.DomUtil.create('div', 'stalk-marker')

  const avatar = L.DomUtil.create('img', 'stalk-avatar', root)
  avatar.alt = name
  if (name.toLowerCase() === 'kazie') {
    avatar.classList.add('rounded-icon')
    avatar.src = 'https://avatars.githubusercontent.com/u/1390887'
  } else {
    avatar.src = buildAvatarUrl(name)
  }

  const orbit = L.DomUtil.create('div', 'heading-orbit', root)
  orbit.hidden = true
  // SVG rather than a CSS-border triangle so the arrow can have a real outline
  const arrow = document.createElementNS(SVG_NS, 'svg')
  arrow.setAttribute('class', 'heading-arrow')
  arrow.setAttribute('viewBox', '0 0 16 14')
  const shape = document.createElementNS(SVG_NS, 'polygon')
  shape.setAttribute('points', '8,1.5 14.5,12.5 1.5,12.5')
  arrow.appendChild(shape)
  orbit.appendChild(arrow)
  const speedLabel = L.DomUtil.create('div', 'speed-label', root)
  speedLabel.hidden = true

  const icon = L.divIcon({
    className: 'stalk-marker-icon',
    html: root,
    iconSize: [50, 50],
    iconAnchor: [25, 25],
    popupAnchor: [0, -25],
  })
  return { icon, orbit, speedLabel }
}

// Popup built from DOM nodes like the icon, so the name never needs escaping
const buildPopup = (name: string) => {
  const content = document.createElement('div')
  L.DomUtil.create('b', '', content).textContent = name
  content.append(' ')
  const popupTime = L.DomUtil.create('span', '', content)
  const popupMotion = L.DomUtil.create('div', '', content)
  return { content, popupTime, popupMotion }
}

// Write text only when it differs; returns whether anything changed
const setText = (element: HTMLElement, text: string): boolean => {
  if (element.textContent === text) return false
  element.textContent = text
  return true
}

// motionChanged comes from applyMotion, so unchanged motion text isn't rebuilt every tick
const updatePopup = (record: MarkerRecord, motionChanged: boolean): void => {
  const timeChanged = setText(record.popupTime, getRelativeTime(record.timestampMs))
  if (motionChanged) setText(record.popupMotion, formatMotion(record.motion ?? {}))
  if (!timeChanged && !motionChanged) return
  record.popupMotion.hidden = !record.popupMotion.textContent
  // Re-layout an open popup whose content size may have changed; no-op while closed. Only on
  // change, since update() on an open popup re-runs autopan and cancels pan animations.
  record.marker.getPopup()?.update()
}

const sameMotion = (a: MotionState | null, b: MotionState): boolean =>
  a !== null && a.speedText === b.speedText && a.heading === b.heading

// Sync the triangle and speed label with the given motion state. Mutates the existing DOM
// rather than calling setIcon so the rotation transition stays smooth and nothing flickers.
// Returns whether anything changed.
const applyMotion = (record: MarkerRecord, motion: MotionState): boolean => {
  if (sameMotion(record.motion, motion)) return false
  record.motion = motion
  const { speedText, heading } = motion
  if (heading !== undefined) {
    record.rotation = shortestRotation(record.rotation, heading)
    record.orbit.style.transform = `rotate(${record.rotation}deg)`
  }
  record.orbit.hidden = heading === undefined
  record.speedLabel.textContent = speedText ?? ''
  record.speedLabel.hidden = speedText === undefined
  return true
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
    const now = Date.now()
    nowTick.value = now
    for (const item of markerInstances) {
      const motionChanged = applyMotion(item, motionState(item.data, now - item.timestampMs))
      updatePopup(item, motionChanged)
    }
  }

  // Fixes under a minute old (which covers MOTION_STALE_MS) tick every second
  const computeNextDelayMs = (): number => {
    const now = Date.now()
    for (const item of markerInstances) {
      if (now - item.timestampMs < 60_000) return 1000
    }
    return Math.max(500, 60_000 - (now % 60_000))
  }

  // Refresh now, then reschedule: fresh data may need a faster tick than the pending one
  const tick = (): void => {
    refreshRelativeTimesAndPopups()
    if (popupUpdateTimer) clearTimeout(popupUpdateTimer)
    popupUpdateTimer = setTimeout(tick, computeNextDelayMs())
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
      tick()
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
        // Unchanged markers keep their object identity, so only parse what actually changed
        if (existing.data !== markerData) {
          existing.data = markerData
          existing.timestampMs = parseISO(markerData.timestamp).getTime()
        }
        // Motion indicators and popup are synced by refreshRelativeTimesAndPopups() below
      } else {
        const { icon, orbit, speedLabel } = buildMarkerIcon(markerData.name)
        const { content, popupTime, popupMotion } = buildPopup(markerData.name)
        const record: MarkerRecord = {
          marker: L.marker(position, { icon }).bindPopup(content),
          data: markerData,
          timestampMs: parseISO(markerData.timestamp).getTime(),
          motion: null,
          rotation: 0,
          orbit,
          speedLabel,
          popupTime,
          popupMotion,
        }
        // Set the initial state before the icon hits the DOM so it doesn't animate in from 0deg
        applyMotion(record, motionState(markerData, Date.now() - record.timestampMs))
        updatePopup(record, true)
        record.marker.addTo(markersLayer!)
        markerByName.set(markerData.name, record)
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
    tick()
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
    tick()
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
