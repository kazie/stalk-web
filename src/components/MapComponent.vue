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
let resizeObserver: ResizeObserver | null = null

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

// Menu expansion state for collapsible targets list (closed by default)
const isMenuExpanded = ref(false)

const toggleMenu = () => {
  isMenuExpanded.value = !isMenuExpanded.value
}

// Expose methods for testing
defineExpose({
  navigateTo,
  isMenuExpanded,
  toggleMenu,
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

    // Render initial markers if any are already present
    updateMapMarkers()

    // Ensure map container size is accurately computed in dynamic containers (e.g. Ladle stories, mobile previews)
    setTimeout(() => {
      map?.invalidateSize()
      updateMapMarkers()
    }, 100)

    resizeObserver = new ResizeObserver(() => {
      map?.invalidateSize()
    })
    resizeObserver.observe(mapContainer.value)
  }

  // Start adaptive ticking to update relative time displays and popups
  if (!popupUpdateTimer) {
    scheduleAdaptiveTick()
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
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
    <div class="markers-info" :class="{ collapsed: !isMenuExpanded }">
      <div
        class="markers-header"
        @click="toggleMenu"
        @keydown.enter="toggleMenu"
        @keydown.space.prevent="toggleMenu"
        role="button"
        tabindex="0"
        :aria-expanded="isMenuExpanded"
      >
        <h3>
          Current Markers ({{ markers.length }})
          <span v-if="currentName" class="view-all" @click.stop="navigateTo(null)">View All</span>
        </h3>
        <button
          class="menu-toggle-btn"
          type="button"
          :aria-label="isMenuExpanded ? 'Collapse markers menu' : 'Expand markers menu'"
          @click.stop="toggleMenu"
        >
          <span class="chevron" :class="{ open: isMenuExpanded }">▾</span>
        </button>
      </div>
      <div v-show="isMenuExpanded" class="markers-body">
        <div v-if="markers.length === 0 && !isLoading" class="no-markers">No markers available</div>
        <div v-else class="markers-list">
          <ul>
            <li v-for="marker in markers" :key="marker.name" class="marker-item">
              <span class="marker-item-main">
                <strong
                  class="marker-name"
                  :class="{ current: marker.name === currentName }"
                  @click="navigateTo(marker.name)"
                  >{{ marker.name }}</strong
                >:
                <code class="marker-coords"
                  >[ {{ marker.latitude.toFixed(5) }}, {{ marker.longitude.toFixed(5) }} ]</code
                >
              </span>
              <span class="marker-time">@ {{ relativeTime(marker.timestamp) }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 8px;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}

.map {
  width: 100%;
  max-width: 100%;
  flex: 1 1 0%;
  min-height: 0;
  border-radius: 8px;
  border: 1px solid #ccc;
  z-index: 1;
}

.header-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
}

h2 {
  margin: 0;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.frequency-dropdown,
.zoom-dropdown {
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: #fff;
  font-size: 14px;
  cursor: pointer;
  min-height: 36px;
}

.free-roaming-toggle,
.live-toggle {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: #f5f5f5;
  font-size: 14px;
  cursor: pointer;
  min-height: 36px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.free-roaming-toggle:hover,
.live-toggle:hover {
  background-color: #e0e0e0;
}

.free-roaming-toggle.active,
.live-toggle.active {
  background-color: #42b983;
  color: white;
  border-color: #42b983;
}

.free-roaming-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: #f0f0f0;
}

.error-message {
  flex-shrink: 0;
  background-color: #ffebee;
  color: #c62828;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 8px;
  font-size: 14px;
}

.markers-info {
  margin-top: 8px;
  flex-shrink: 0;
  border: 1px solid var(--color-border, #eee);
  border-radius: 8px;
  background-color: var(--color-background, #fff);
  display: flex;
  flex-direction: column;
  transition:
    max-height 0.3s ease,
    box-shadow 0.3s ease;
  z-index: 10;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  max-height: 40vh;
}

.markers-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.markers-header:hover {
  background-color: var(--color-background-soft, #f8f8f8);
}

.markers-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-toggle-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text, #333);
  border-radius: 4px;
}

.chevron {
  display: inline-block;
  transition: transform 0.25s ease;
  font-size: 16px;
  line-height: 1;
}

.chevron.open {
  transform: rotate(180deg);
}

.markers-body {
  max-height: min(200px, 30vh);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 4px 12px 12px;
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

.marker-item {
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border, #f5f5f5);
  font-size: 14px;
  color: var(--color-text, #333);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.marker-item-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.marker-coords {
  background: var(--color-background-mute, #f5f5f5);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  word-break: break-all;
}

.marker-time {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

.marker-name {
  cursor: pointer;
  color: var(--color-heading, #2c3e50);
  padding: 2px 4px;
  border-radius: 4px;
  transition:
    color 0.2s,
    background-color 0.2s;
}

.marker-name:hover {
  color: #42b983;
  text-decoration: underline;
  background-color: var(--color-background-soft, #f0f0f0);
}

.marker-name.current {
  color: #42b983;
  font-weight: bold;
}

.view-all {
  font-size: 13px;
  font-weight: normal;
  margin-left: 8px;
  color: #42b983;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: rgba(66, 185, 131, 0.1);
  transition: background-color 0.2s;
}

.view-all:hover {
  background-color: rgba(66, 185, 131, 0.2);
  text-decoration: underline;
}

/* Mobile specific styling */
@media (max-width: 768px) {
  .map-container {
    padding: 6px;
  }

  .header-controls {
    margin-bottom: 6px;
    gap: 6px;
  }

  h2 {
    font-size: 1.05rem;
    width: 100%;
  }

  .controls {
    width: 100%;
    justify-content: space-between;
    gap: 4px;
  }

  .frequency-dropdown,
  .zoom-dropdown {
    font-size: 13px;
    padding: 4px 6px;
    min-height: 34px;
  }

  .free-roaming-toggle,
  .live-toggle {
    font-size: 13px;
    padding: 4px 8px;
    min-height: 34px;
  }

  .markers-info {
    position: absolute;
    bottom: 6px;
    left: 6px;
    right: 6px;
    margin-top: 0;
    border: 1px solid var(--color-border, #ddd);
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    background: var(--color-background, rgba(255, 255, 255, 0.96));
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 1000;
  }

  .markers-header {
    padding: 10px 14px;
    min-height: 44px; /* standard mobile touch target */
  }

  .markers-body {
    max-height: 40vh;
    overflow-y: auto;
    padding: 0 14px 14px;
  }

  .marker-item {
    padding: 10px 0;
    min-height: 44px;
  }

  .marker-name {
    font-size: 15px;
    padding: 4px 8px;
    background-color: var(--color-background-soft, #f0f0f0);
    border-radius: 4px;
  }
}
</style>
