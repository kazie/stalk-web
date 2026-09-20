<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  currentName,
  error,
  isLoading,
  markers,
  startFetching,
  startFetchingByName,
  startLive,
  startLiveByName,
  stopUpdates,
  updateMode,
  UpdateMode,
} from '@/services/markerService'
import MapToolbar from './MapToolbar.vue'
import MarkerList from './MarkerList.vue'
import StalkingPanel from './StalkingPanel.vue'
import { useLeafletMarkers } from '@/composables/useLeafletMarkers'

const props = defineProps<{
  name?: string
}>()

const router = useRouter()
const { mapContainer } = useLeafletMarkers()
const isMenuExpanded = ref(false)

const startMarkerUpdates = (name?: string): void => {
  stopUpdates()

  if (name) {
    if (updateMode.value === UpdateMode.Live) startLiveByName(name)
    else startFetchingByName(name)
    return
  }

  // Keep the heading and marker stream aligned when returning to all users.
  currentName.value = null
  if (updateMode.value === UpdateMode.Live) startLive()
  else startFetching()
}

watch(() => props.name, startMarkerUpdates, { immediate: true })
watch(updateMode, () => startMarkerUpdates(currentName.value ?? undefined))

const navigateTo = (name: string | null): void => {
  router.push(name ? `/${name}` : '/')
}

const toggleMenu = (): void => {
  isMenuExpanded.value = !isMenuExpanded.value
}

defineExpose({ navigateTo, isMenuExpanded, toggleMenu })

onUnmounted(() => {
  stopUpdates()
})
</script>

<template>
  <div class="map-container">
    <div class="map-content">
      <MapToolbar :current-name="currentName" />
      <div v-if="error" class="error-message">{{ error }}</div>
      <div ref="mapContainer" class="map"></div>
      <MarkerList
        :markers="markers"
        :current-name="currentName"
        :is-loading="isLoading"
        :expanded="isMenuExpanded"
        @navigate="navigateTo"
        @toggle="toggleMenu"
      />
    </div>
    <StalkingPanel />
  </div>
</template>

<style scoped>
.map-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  margin: 0 auto;
  box-sizing: border-box;
}

.map-content {
  min-width: 0;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
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

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 14px;
}
</style>
