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
  zoomLevelOptions,
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
      <button
        class="tool toggle live-toggle"
        type="button"
        :class="{ active: updateMode === UpdateMode.Live }"
        :aria-pressed="updateMode === UpdateMode.Live"
        :title="updateMode === UpdateMode.Live ? 'LIVE enabled' : 'LIVE disabled (Polling)'"
        @click="setUpdateMode(updateMode === UpdateMode.Live ? UpdateMode.Poll : UpdateMode.Live)"
      >
        <span aria-hidden="true">📡</span> LIVE
      </button>
      <div v-if="updateMode !== UpdateMode.Live" class="control">
        <label for="refresh-rate">
          <span class="control-icon" aria-hidden="true">🔄</span>
          <span class="visually-hidden">Refresh rate</span>
        </label>
        <select
          id="refresh-rate"
          class="tool frequency-dropdown"
          :value="updateFrequency"
          @change="(e: Event) => setUpdateFrequency(Number((e.target as HTMLSelectElement).value))"
        >
          <option value="1000">1s</option>
          <option value="5000">5s</option>
          <option value="10000">10s</option>
          <option value="30000">30s</option>
        </select>
      </div>
      <div class="control">
        <label for="zoom-level">
          <span class="control-icon" aria-hidden="true">🔍</span>
          <span class="visually-hidden">Zoom level</span>
        </label>
        <select
          id="zoom-level"
          ref="zoomSelectEl"
          class="tool zoom-dropdown"
          v-model.number="selectedZoom"
          @focus="onZoomFocus"
          @pointerdown="onZoomPointerDown"
          @touchstart="onZoomPointerDown"
          @blur="onZoomBlur"
          @change="onZoomChange"
          v-memo="[selectedZoom, isZoomInteracting]"
        >
          <option v-for="option in zoomLevelOptions" :key="option.level" :value="option.level">
            {{ option.label }}
          </option>
        </select>
      </div>
      <button
        class="tool toggle free-roaming-toggle"
        type="button"
        aria-label="Free roam"
        :class="{ active: freeRoamingMode }"
        :aria-pressed="freeRoamingMode"
        :disabled="markers.length === 0"
        :title="
          markers.length === 0 ? 'Free roaming is enforced when there are no markers' : 'Free roam'
        "
        @click="toggleFreeRoamingMode"
      >
        <span aria-hidden="true">🗺️</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.header-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 12px;
}

h2 {
  margin: 0;
  min-width: 0;
  color: var(--color-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
}

.control {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Every menu and button in the toolbar */
.tool {
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid var(--color-border-hover);
  background-color: var(--color-background-soft);
  color: var(--color-heading);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.toggle {
  padding: 6px 12px;
  transition: background-color 0.2s;
}

@media (hover: hover) {
  .toggle:not(:disabled, .active):hover {
    background-color: var(--color-background-mute);
  }
}

.toggle.active {
  background-color: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.free-roaming-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@container app (max-width: 768px) {
  .header-controls {
    gap: 6px;
    margin: 0;
    padding: calc(8px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) 8px
      calc(12px + env(safe-area-inset-left));
  }

  /* Full row, leaving room for the fixed "Stalk me" button in the top-right corner */
  h2 {
    flex: 1 1 100%;
    min-height: 40px;
    line-height: 40px;
    padding-right: 128px;
    font-size: 17px;
    font-weight: 600;
  }

  /* 16px stops iOS zooming in on focus; 44px is a comfortable touch target */
  .tool {
    min-height: var(--touch-target);
    font-size: 16px;
  }

  .free-roaming-toggle {
    min-width: var(--touch-target);
  }

  /* Keeps the toolbar on one row; "5s" and "Medium" say what the menus are, and screen readers
     still get the labels */
  .control-icon {
    display: none;
  }

  .control {
    gap: 0;
  }
}
</style>
