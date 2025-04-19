<script setup lang="ts">
import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import 'leaflet/dist/leaflet.css'
import L, { LatLng } from 'leaflet'

// Fix Leaflet's default icon path issues
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix the icon paths for Leaflet
const KazieIcon = L.icon({
  iconUrl: 'https://avatars.githubusercontent.com/u/1390887',
  iconSize: [50, 50],
  iconAnchor: [25, 25],
  popupAnchor: [0, -25],
})

// Define the office coordinates (example: San Francisco)
const officeCoordinates: Ref<LatLng> = ref(L.latLng(59.32721756211293, 18.107101093216905))

// Create refs for the map container and the Leaflet map instance
const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null

// Initialize the map when the component is mounted
onMounted(() => {
  if (mapContainer.value) {
    // Create the map instance
    map = L.map(mapContainer.value).setView(officeCoordinates.value, 13)

    // Add the OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    // Set the default icon for all markers
    L.Marker.prototype.options.icon = KazieIcon

    // Add a marker at the office location
    const marker = L.marker(officeCoordinates.value).addTo(map)

    // Add a popup to the marker
    marker.bindPopup('<b>Kazie</b>')
  }
})

// Clean up the map when the component is unmounted
onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="map-container">
    <h2>Stalking...</h2>
    <div ref="mapContainer" class="map"></div>
    <p>Kazie coordinates: {{ officeCoordinates.lat }}, {{ officeCoordinates.lng }}</p>
  </div>
</template>

<style scoped>
.map-container {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 20px;
}

.map {
  height: 90vh;
  width: 95vw;
  border-radius: 8px;
  border: 1px solid #ccc;
}

h2 {
  margin-bottom: 16px;
}

p {
  margin-top: 8px;
  font-size: 14px;
  color: #666;
}
</style>
