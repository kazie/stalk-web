<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import {
  currentName,
  error,
  freeRoamingMode,
  isLoading,
  markers,
  startFetching,
  startFetchingByName,
  startLive,
  startLiveByName,
  stopUpdates,
  toggleFreeRoamingMode,
  updateFrequency,
  setUpdateFrequency,
  currentZoomLevel,
  setZoomLevel,
  ZoomLevel,
  updateMode,
  setUpdateMode,
  UpdateMode,
} from '@/services/markerService'
import { getRelativeTime } from '@/services/timeTool.ts'
import { useRouter } from 'vue-router'
import { parseISO } from 'date-fns'

// Define props
const props = defineProps<{
  name?: string
}>()

const router = useRouter()

const buildAvatarUrl = (name: string) => {
  const url = new URL('https://ui-avatars.com/api/')
  const params = new URLSearchParams({
    name: name,
    background: 'random',
    format: 'svg',
    rounded: 'true',
  })
  url.search = params.toString()
  return url.toString()
}

// Create a map of icons based on names
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

  if (name.toLowerCase() === 'kaichan') {
    // FIXKE: need a nice pic
  }

  // For other names, you could use different icons
  // For example, using initials or other patterns
  return L.icon({
    iconUrl: buildAvatarUrl(name),
    iconSize: [50, 50],
    iconAnchor: [25, 25],
    popupAnchor: [0, -25],
  })
}

// Create refs for the map container and the Leaflet map instance
const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let markersLayer: L.LayerGroup | null = null
const autoEnforcedFreeRoaming = ref(false)

// Track markers to enable live popup content updates
let markerInstances: Array<{ marker: L.Marker; name: string; timestamp: string }> = []
// Map for reconciling markers by name to preserve open popups and move in place
let markerByName = new Map<string, { marker: L.Marker; name: string; timestamp: string }>()

// A ticking ref to trigger reactive re-computation of relative times in the template
const nowTick = ref(Date.now())

// Helper to make getRelativeTime reactive over time without changing call sites extensively
const relativeTime = (iso: string): string => {
  // Read the ticking ref to create a reactive dependency
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  nowTick.value
  return getRelativeTime(iso)
}

// Adaptive timer for updating tick and popup contents
let popupUpdateTimer: ReturnType<typeof setTimeout> | null = null

// Locally track the selected zoom to avoid DOM value being reset by unrelated reactive updates (prevents mobile picker re-opening)
const selectedZoom = ref<number>(currentZoomLevel.value)

// Track when the user is interacting with the zoom <select> to avoid syncing while the native picker is open
const isZoomInteracting = ref(false)
const zoomSelectEl = ref<HTMLSelectElement | null>(null)

const onZoomFocus = () => {
  isZoomInteracting.value = true
}
const onZoomPointerDown = () => {
  // Triggered by mouse/pointer/touch before the native picker opens
  isZoomInteracting.value = true
}
const onZoomBlur = () => {
  // User cancelled or closed the picker without committing a change
  isZoomInteracting.value = false
}

// Keep the local select value in sync if zoom is changed programmatically elsewhere
// but do NOT override while the user is interacting with the control
watch(
  currentZoomLevel,
  (z) => {
    // If the user is interacting (picker open/focused), skip syncing
    if (isZoomInteracting.value) return

    // As a safety net, also avoid syncing if the select currently has focus
    const el = zoomSelectEl.value
    if (el && document.activeElement === el) return

    if (selectedZoom.value !== z) selectedZoom.value = z
  },
  { immediate: false },
)

// Handler invoked when user changes the zoom via the dropdown
const onZoomChange = () => {
  // Cast to ZoomLevel since selected value is a number that matches enum values
  setZoomLevel(selectedZoom.value as ZoomLevel)
  // Resume syncing after the user committed a change
  isZoomInteracting.value = false
}

function refreshRelativeTimesAndPopups() {
  // Advance tick to trigger Vue reactivity for list rendering
  nowTick.value = Date.now()
  // Refresh popup contents for all tracked markers
  if (markerInstances.length > 0) {
    for (const it of markerInstances) {
      const html = `<b>${it.name}</b> ${getRelativeTime(it.timestamp)}`
      const popup = it.marker.getPopup()
      if (popup) it.marker.setPopupContent(html)
      else it.marker.bindPopup(html)
    }
  }
}

function computeNextDelayMs(): number {
  const now = Date.now()
  // 1s cadence if any marker is newer than 60s
  for (const it of markerInstances) {
    const ageMs = now - parseISO(it.timestamp).getTime()
    if (ageMs < 60_000) return 1000
  }
  // Otherwise align to the next minute boundary
  const msToNextMinute = 60_000 - (now % 60_000)
  return Math.max(500, msToNextMinute)
}

function scheduleAdaptiveTick() {
  if (popupUpdateTimer) clearTimeout(popupUpdateTimer)
  const delay = computeNextDelayMs()
  popupUpdateTimer = setTimeout(() => {
    refreshRelativeTimesAndPopups()
    scheduleAdaptiveTick()
  }, delay)
}

// Watch for changes in markers and update the map
watch(
  markers,
  () => {
    updateMapMarkers()
  },
  { deep: true },
)

// Update markers on the map
const updateMapMarkers = () => {
  if (!map) return

  // Ensure markersLayer exists
  if (!markersLayer) {
    markersLayer = L.layerGroup().addTo(map)
  }

  // No markers: clear all existing and enforce free roaming/default view
  if (markers.value.length === 0) {
    // Remove existing markers from layer and tracking
    for (const { marker } of markerByName.values()) {
      markersLayer.removeLayer(marker)
    }
    markerByName.clear()
    markerInstances = []

    if (!freeRoamingMode.value) {
      freeRoamingMode.value = true
      autoEnforcedFreeRoaming.value = true
    }

    if (map && !freeRoamingMode.value) {
      map.setView([62, 15], ZoomLevel.CountryFar)
    }

    // Immediate refresh for list/popup labels
    refreshRelativeTimesAndPopups()
    return
  }

  // If we previously enforced free roaming due to zero markers, lift it now
  if (autoEnforcedFreeRoaming.value && freeRoamingMode.value) {
    freeRoamingMode.value = false
    autoEnforcedFreeRoaming.value = false
  }

  const bounds = L.latLngBounds([])
  const incomingNames = new Set<string>()

  // Upsert markers by name to preserve open popups and move in place
  for (const markerData of markers.value) {
    incomingNames.add(markerData.name)
    const position = L.latLng(markerData.latitude, markerData.longitude)
    bounds.extend(position)

    const existing = markerByName.get(markerData.name)
    if (existing) {
      // Move marker to new coordinates (popup will follow if open)
      existing.marker.setLatLng(position)
      // Update timestamp in tracking
      existing.timestamp = markerData.timestamp

      // If popup is open, refresh its content immediately
      const popup = existing.marker.getPopup()
      // @ts-ignore cross-version Leaflet guard
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
      // Create a new marker
      const icon = getIconForName(markerData.name)
      const newMarker = L.marker(position, { icon }).addTo(markersLayer!)
      newMarker.bindPopup(`<b>${markerData.name}</b> ${getRelativeTime(markerData.timestamp)}`)
      markerByName.set(markerData.name, {
        marker: newMarker,
        name: markerData.name,
        timestamp: markerData.timestamp,
      })
    }
  }

  // Remove markers that disappeared
  for (const [name, rec] of markerByName.entries()) {
    if (!incomingNames.has(name)) {
      markersLayer.removeLayer(rec.marker)
      markerByName.delete(name)
    }
  }

  // Rebuild markerInstances for adaptive popup refresh logic
  markerInstances = Array.from(markerByName.values()).map(({ marker, name, timestamp }) => ({
    marker,
    name,
    timestamp,
  }))

  // Adjust the map view if free roaming mode is disabled
  if (!freeRoamingMode.value) {
    if (markers.value.length === 1) {
      const single = markers.value[0]
      if (single) {
        map.setView([single.latitude, single.longitude], currentZoomLevel.value, { animate: true })
      }
    } else if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], animate: true })
    }
  }

  // Immediate refresh of relative time labels and popup contents on data updates
  refreshRelativeTimesAndPopups()
}

// Watch for changes in the name prop
watch(
  () => props.name,
  (newName) => {
    // Stop any existing updates first
    stopUpdates()

    if (newName) {
      // Start updates for the specific name
      if (updateMode.value === UpdateMode.Live) {
        startLiveByName(newName)
      } else {
        startFetchingByName(newName)
      }
    } else {
      // Start updates for all markers
      if (updateMode.value === UpdateMode.Live) {
        startLive()
      } else {
        startFetching()
      }
    }
  },
  { immediate: true },
)

// Restart when switching between Poll and Live
watch(
  updateMode,
  () => {
    stopUpdates()
    if (currentName.value) {
      if (updateMode.value === UpdateMode.Live) {
        startLiveByName(currentName.value)
      } else {
        startFetchingByName(currentName.value)
      }
    } else {
      if (updateMode.value === UpdateMode.Live) {
        startLive()
      } else {
        startFetching()
      }
    }
  },
  { immediate: false },
)

// Navigate to a specific name using Vue Router
const navigateTo = (name: string | null) => {
  if (name) {
    router.push(`/${name}`)
  } else {
    router.push('/')
  }
}

// Expose methods for testing
defineExpose({
  navigateTo,
})

// Initialize the map when the component is mounted
onMounted(() => {
  if (mapContainer.value) {
    // Create the map instance with a default view
    map = L.map(mapContainer.value).setView([62, 15], 4)

    // Add the OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
  }

  // Start adaptive ticking to update relative time displays and popups
  if (!popupUpdateTimer) {
    scheduleAdaptiveTick()
  }
})

onUnmounted(() => {
  if (popupUpdateTimer) {
    clearTimeout(popupUpdateTimer)
    popupUpdateTimer = null
  }
})

// Clean up the map and stop fetching when the component is unmounted
onUnmounted(() => {
  // Stop all updates (polling or live)
  stopUpdates()

  // Remove the map
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="map-container">
    <div class="header-controls">
      <h2>Stalking... {{ currentName ? currentName : 'everyone' }}</h2>
      <div class="controls">
        <label v-if="updateMode !== UpdateMode.Live" for="refresh-rate">🔄</label>
        <select
          v-if="updateMode !== UpdateMode.Live"
          class="frequency-dropdown"
          :value="updateFrequency"
          @change="(e: Event) => setUpdateFrequency(Number((e.target as HTMLSelectElement).value))"
        >
          <option value="1000">1s</option>
          <option value="5000">5s</option>
          <option value="10000">10s</option>
          <option value="30000">30s</option>
        </select>
        <label for="mode">📡</label>
        <button
          class="live-toggle"
          @click="setUpdateMode(updateMode === UpdateMode.Live ? UpdateMode.Poll : UpdateMode.Live)"
          :class="{ active: updateMode === UpdateMode.Live }"
          :title="updateMode === UpdateMode.Live ? 'LIVE enabled' : 'LIVE disabled (Polling)'"
        >
          LIVE
        </button>
        <label for="zoom-level">🔍</label>
        <select
          id="zoom-level"
          ref="zoomSelectEl"
          class="zoom-dropdown"
          v-model.number="selectedZoom"
          @focus="onZoomFocus"
          @pointerdown="onZoomPointerDown"
          @touchstart="onZoomPointerDown"
          @blur="onZoomBlur"
          @change="onZoomChange"
          v-memo="[selectedZoom, isZoomInteracting]"
        >
          <option :value="ZoomLevel.Close">Close</option>
          <option :value="ZoomLevel.Medium">Medium</option>
          <option :value="ZoomLevel.Far">Far</option>
          <option :value="ZoomLevel.VeryFar">Very Far</option>
        </select>
        <label for="free-roaming-mode">️️🗺️</label>
        <button
          class="free-roaming-toggle"
          @click="toggleFreeRoamingMode"
          :class="{ active: freeRoamingMode }"
          :disabled="markers.length === 0"
          :title="markers.length === 0 ? 'Free roaming is enforced when there are no markers' : ''"
        >
          {{ freeRoamingMode ? 'ON' : 'OFF' }}
        </button>
      </div>
    </div>
    <div v-if="error" class="error-message">{{ error }}</div>
    <div ref="mapContainer" class="map"></div>
    <div class="markers-info">
      <div v-if="markers.length === 0 && !isLoading" class="no-markers">No markers available</div>
      <div v-else class="markers-list">
        <h3>
          Current Markers ({{ markers.length }})
          <span v-if="currentName" class="view-all" @click="navigateTo(null)">View All</span>
        </h3>
        <ul>
          <li v-for="marker in markers" :key="marker.name">
            <strong
              class="marker-name"
              :class="{ current: marker.name === currentName }"
              @click="navigateTo(marker.name)"
              >{{ marker.name }}</strong
            >:
            <code>[ {{ marker.latitude.toFixed(5) }}, {{ marker.longitude.toFixed(5) }} ]</code> @
            {{ relativeTime(marker.timestamp) }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  padding: 10px;
  box-sizing: border-box;
}

.map {
  height: calc(100vh - 200px);
  width: 100%;
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid #ccc;
  flex: 1;
}

.header-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

h2 {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  margin-right: 16px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.frequency-dropdown,
.zoom-dropdown,
.mode-dropdown {
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.free-roaming-toggle {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: #f5f5f5;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.free-roaming-toggle:hover {
  background-color: #e0e0e0;
}

.free-roaming-toggle.active {
  background-color: #42b983;
  color: white;
  border-color: #42b983;
}

.free-roaming-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: #f0f0f0;
}

/* LIVE mode toggle button */
.live-toggle {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: #f5f5f5;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.live-toggle:hover {
  background-color: #e0e0e0;
}

.live-toggle.active {
  background-color: #42b983;
  color: white;
  border-color: #42b983;
}

h3 {
  margin-top: 16px;
  margin-bottom: 8px;
  font-size: 16px;
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 14px;
}

.markers-info {
  margin-top: 16px;
  max-height: 150px;
  overflow-y: auto;
  border-top: 1px solid #eee;
  padding-top: 8px;
}

.no-markers {
  color: #666;
  font-style: italic;
  padding: 8px 0;
}

.markers-list ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.markers-list li {
  padding: 4px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 14px;
  color: #333;
}

@keyframes pulse {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}

.marker-name {
  cursor: pointer;
  color: #2c3e50;
  transition: color 0.2s;
}

.marker-name:hover {
  color: #42b983;
  text-decoration: underline;
}

.marker-name.current {
  color: #42b983;
  font-weight: bold;
}

.view-all {
  font-size: 14px;
  font-weight: normal;
  margin-left: 10px;
  color: #42b983;
  cursor: pointer;
  transition: color 0.2s;
}

.view-all:hover {
  text-decoration: underline;
}
</style>
