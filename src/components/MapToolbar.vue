<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  currentZoomLevel,
  freeRoamingMode,
  markers,
  setUpdateFrequency,
  setUpdateMode,
  setZoomLevel,
  toggleFreeRoamingMode,
  updateFrequency,
  updateMode,
  UpdateMode,
  ZoomLevel,
} from '@/services/markerService'

defineProps<{
  currentName: string | null
}>()

const selectedZoom = ref<number>(currentZoomLevel.value)
const isZoomInteracting = ref(false)
const zoomSelectEl = ref<HTMLSelectElement | null>(null)

const onZoomFocus = (): void => {
  isZoomInteracting.value = true
}

const onZoomPointerDown = (): void => {
  isZoomInteracting.value = true
}

const onZoomBlur = (): void => {
  isZoomInteracting.value = false
}

watch(currentZoomLevel, (zoom) => {
  if (isZoomInteracting.value) return
  const element = zoomSelectEl.value
  if (element && document.activeElement === element) return
  if (selectedZoom.value !== zoom) selectedZoom.value = zoom
})

const onZoomChange = (): void => {
  setZoomLevel(selectedZoom.value as ZoomLevel)
  isZoomInteracting.value = false
}
</script>

<template>
  <div class="header-controls">
    <h2>Stalking... {{ currentName || 'everyone' }}</h2>
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
</template>

<style scoped>
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

.free-roaming-toggle,
.live-toggle {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: #f5f5f5;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
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
</style>
