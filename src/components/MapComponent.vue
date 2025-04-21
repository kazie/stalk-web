<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { markers, isLoading, error, startFetching, stopFetching } from '@/services/markerService'
import { getRelativeTime } from '@/services/timeTool.ts'

const buildAvatarUrl = (name: string) => {
  const url = new URL('https://ui-avatars.com/api/');
  const params = new URLSearchParams({
    name: name,
    background: 'random',
    format: 'svg',
    rounded: 'true'
  });
  url.search = params.toString();
  return url.toString();
};


// Create a map of icons based on names
const getIconForName = (name: string): L.Icon => {
  // Default icon
  const kazieIcon = L.icon({
    className: 'rounded-icon',
    iconUrl: 'https://avatars.githubusercontent.com/u/1390887',
    iconSize: [50, 50],
    iconAnchor: [25, 25],
    popupAnchor: [0, -25],
  })

  if (name.toLowerCase() === 'kazie') {
    return kazieIcon
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

// Watch for changes in markers and update the map
watch(markers, () => {
  updateMapMarkers()
})

// Update markers on the map
const updateMapMarkers = () => {
  if (!map) return

  // Clear existing markers
  if (markersLayer) {
    markersLayer.clearLayers()
  } else {
    markersLayer = L.layerGroup().addTo(map)
  }

  // Add new markers
  if (markers.value.length > 0) {
    // Create bounds to fit all markers
    const bounds = L.latLngBounds([])

    markers.value.forEach((markerData) => {
      const position = L.latLng(markerData.latitude, markerData.longitude)
      bounds.extend(position)

      const icon = getIconForName(markerData.name)
      const marker = L.marker(position, { icon }).addTo(markersLayer!)

      // Add a popup to the marker
      marker.bindPopup(`<b>${markerData.name}</b> ${getRelativeTime(markerData.timestamp)}`)
    })

    if (markers.value.length == 1) {
      // For a single marker, set a moderate zoom level (not too close)
      const marker = markers.value[0]
      map.setView([marker.latitude, marker.longitude], 15)
    }
    // Fit the map to show all markers
    else if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  } else if (map) {
    // If no markers, set a default view
    map.setView([62, 15], 4)
  }
}

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

    // Start fetching marker data
    startFetching()
  }
})

// Clean up the map and stop fetching when the component is unmounted
onUnmounted(() => {
  // Stop fetching marker data
  stopFetching()

  // Remove the map
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="map-container">
    <h2>Stalking... <span v-if="isLoading" class="loading-indicator">Loading...</span></h2>
    <div v-if="error" class="error-message">{{ error }}</div>
    <div ref="mapContainer" class="map"></div>
    <div class="markers-info">
      <div v-if="markers.length === 0 && !isLoading" class="no-markers">No markers available</div>
      <div v-else class="markers-list">
        <h3>Current Markers ({{ markers.length }})</h3>
        <ul>
          <li v-for="marker in markers" :key="marker.name">
            <strong>{{ marker.name }}</strong
            >:
            <code>[ {{ marker.latitude.toFixed(5) }}, {{ marker.longitude.toFixed(5) }} ]</code> @
            {{ getRelativeTime(marker.timestamp) }}
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

h2 {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}

h3 {
  margin-top: 16px;
  margin-bottom: 8px;
  font-size: 16px;
}

.loading-indicator {
  margin-left: 10px;
  font-size: 14px;
  color: #666;
  font-weight: normal;
  animation: pulse 1.5s infinite;
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

</style>