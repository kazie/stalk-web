<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type ComponentPublicInstance } from 'vue'
import { useRouter } from 'vue-router'
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
  updateMode,
  UpdateMode,
} from '@/services/markerService'
import MapToolbar from './MapToolbar.vue'
import MarkerList from './MarkerList.vue'
import StalkingPanel from './StalkingPanel.vue'
import { useMapMarkers } from '@/composables/useMapMarkers'
import { fallbackUrl } from '@/services/webglSupport'

const props = defineProps<{
  name?: string
}>()

const router = useRouter()
const { mapContainer, mapError, recenter } = useMapMarkers()
const classicUrl = fallbackUrl()
const isMenuExpanded = ref(false)
const followLabel = computed(() => `Follow ${currentName.value || 'everyone'}`)

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
  // Same target: the route doesn't change, but the map should still go back to them
  if (name && name === currentName.value) recenter()
  else router.push(name ? `/${name}` : '/')
}

const toggleMenu = (): void => {
  isMenuExpanded.value = !isMenuExpanded.value
}

defineExpose({ navigateTo, isMenuExpanded, toggleMenu })

// On phones the marker list floats over the map. Its height (collapsed, open, larger text) sets
// how far the map's bottom controls and the Follow button move up.
const mapContent = ref<HTMLElement | null>(null)
const markerList = ref<ComponentPublicInstance | null>(null)
let listObserver: ResizeObserver | null = null

onMounted(() => {
  const list = markerList.value?.$el as HTMLElement | undefined
  if (!list || typeof ResizeObserver === 'undefined') return
  listObserver = new ResizeObserver(([entry]) => {
    const height = entry?.borderBoxSize[0]?.blockSize ?? 0
    mapContent.value?.style.setProperty('--marker-list-height', `${height}px`)
  })
  listObserver.observe(list)
})

onUnmounted(() => {
  listObserver?.disconnect()
  stopUpdates()
})
</script>

<template>
  <div class="map-container">
    <div ref="mapContent" class="map-content">
      <MapToolbar :current-name="currentName" />
      <div v-if="error" class="error-message">{{ error }}</div>
      <div v-if="mapError" class="error-message">
        {{ mapError }}
        <a v-if="classicUrl" class="fallback-link" :href="classicUrl">
          Switch to the classic version
        </a>
      </div>
      <div class="map-area">
        <div ref="mapContainer" class="map"></div>
        <button
          v-if="freeRoamingMode && markers.length > 0"
          class="recenter-btn"
          type="button"
          :title="followLabel"
          @click="recenter"
        >
          <span aria-hidden="true">◎</span> {{ followLabel }}
        </button>
      </div>
      <MarkerList
        ref="markerList"
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
/* The layout switches on the app's own width, not the window's, so it also works when the app
   is shown at phone size inside a larger page (the "Mobile Device View" story). */
.map-container {
  container: app / inline-size;
  width: 100%;
  max-width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  margin: 0 auto;
  box-sizing: border-box;
}

.map-content {
  /* Room the overlaid marker list takes at the map's bottom edge (mobile only) */
  --map-bottom-inset: 0px;
  position: relative;
  min-width: 0;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  /* Tablets and landscape phones wider than 768px get this layout too, notch and all */
  padding: calc(10px + env(safe-area-inset-top)) 10px calc(10px + env(safe-area-inset-bottom))
    calc(10px + env(safe-area-inset-left));
  box-sizing: border-box;
}

.map-area {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}

.map {
  flex: 1;
  min-width: 0;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.recenter-btn {
  position: absolute;
  /* A long name is cut short rather than running across the map; the title shows it in full */
  max-width: calc(100% - 20px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  right: 10px;
  /* Above MapLibre's attribution in the bottom-right corner */
  bottom: calc(var(--map-bottom-inset) + 40px);
  z-index: 2;
  min-height: var(--touch-target);
  padding: 0 16px;
  border: 1px solid var(--color-border);
  border-radius: calc(var(--touch-target) / 2);
  background: var(--color-background);
  color: var(--color-heading);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.error-message {
  background-color: var(--color-danger-bg);
  color: var(--color-danger-text);
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 8px;
  font-size: 14px;
}

.error-message .fallback-link {
  margin-left: 4px;
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
}

@container app (max-width: 768px) {
  .map-content {
    /* The list sits 6px above the bottom edge. Until it's measured, assume it's collapsed: one
       touch-target row plus its border. */
    --map-bottom-inset: calc(
      var(--marker-list-height, calc(var(--touch-target) + 2px)) + 6px + env(safe-area-inset-bottom)
    );
    padding: 0;
  }

  /* Edge to edge: every pixel of a phone screen goes to the map */
  .map {
    border-radius: 0;
    border-width: 1px 0 0;
  }

  .error-message {
    margin: 0;
    border-radius: 0;
  }

  /* Keep the map attribution and controls clear of the marker list and the home bar */
  .map :deep(.maplibregl-ctrl-bottom-left),
  .map :deep(.maplibregl-ctrl-bottom-right) {
    bottom: var(--map-bottom-inset);
  }

  /* Clear the notch in landscape */
  .map :deep(.maplibregl-ctrl-top-left),
  .map :deep(.maplibregl-ctrl-bottom-left) {
    left: env(safe-area-inset-left);
  }

  .map :deep(.maplibregl-ctrl-top-right),
  .map :deep(.maplibregl-ctrl-bottom-right) {
    right: env(safe-area-inset-right);
  }
}
</style>
