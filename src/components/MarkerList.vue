<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { MarkerData } from '@/services/markerService'
import { describeMotion } from '@/services/motion'
import { getRelativeTime } from '@/services/timeTool'

const props = defineProps<{
  markers: MarkerData[]
  currentName: string | null
  isLoading: boolean
  expanded: boolean
}>()

const emit = defineEmits<{
  navigate: [name: string | null]
  toggle: []
}>()

const nowTick = ref(Date.now())
let relativeTimeTimer: ReturnType<typeof setInterval> | null = null

const relativeTime = (timestamp: string): string => {
  nowTick.value
  return getRelativeTime(timestamp)
}

const motionText = (marker: MarkerData): string => {
  const text = describeMotion(marker, nowTick.value, ' ')
  return text && `· ${text}`
}

// The collapsed list stays rendered (v-show), so only tick while it can be seen
watch(
  () => props.expanded,
  (expanded) => {
    if (expanded) nowTick.value = Date.now()
  },
)

onMounted(() => {
  relativeTimeTimer = setInterval(() => {
    if (props.expanded) nowTick.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (relativeTimeTimer !== null) clearInterval(relativeTimeTimer)
})
</script>

<template>
  <div class="markers-info" :class="{ collapsed: !props.expanded }">
    <div class="markers-header">
      <h3>
        <button
          class="markers-toggle"
          type="button"
          aria-controls="markers-body"
          :aria-expanded="props.expanded"
          :class="{ open: props.expanded }"
          @click="emit('toggle')"
        >
          Current Markers ({{ props.markers.length }})
        </button>
      </h3>
      <button
        v-if="props.currentName"
        class="view-all"
        type="button"
        @click="emit('navigate', null)"
      >
        View All
      </button>
    </div>
    <div v-show="props.expanded" id="markers-body" class="markers-body">
      <div v-if="props.markers.length === 0 && !props.isLoading" class="no-markers">
        No markers available
      </div>
      <div v-else class="markers-list">
        <ul>
          <li v-for="marker in props.markers" :key="marker.name" class="marker-item">
            <button
              class="marker-row"
              type="button"
              :class="{ current: marker.name === props.currentName }"
              :aria-current="marker.name === props.currentName ? 'true' : undefined"
              @click="emit('navigate', marker.name)"
            >
              <strong class="marker-name">{{ marker.name }}</strong>
              <span class="marker-motion">{{ motionText(marker) }}</span>
              <code class="marker-coords"
                >{{ marker.latitude.toFixed(5) }}, {{ marker.longitude.toFixed(5) }}</code
              >
              <span class="marker-time">{{ relativeTime(marker.timestamp) }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.markers-info {
  margin-top: 12px;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-background);
  display: flex;
  flex-direction: column;
  max-height: 40vh;
  max-height: 40dvh;
}

.markers-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 8px;
  flex-shrink: 0;
}

.markers-header h3 {
  flex: 1;
  min-width: 0;
  margin: 0;
}

/* The whole header row toggles the list */
.markers-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--color-heading);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

/* Drawn by CSS (with empty alt text) so the heading text stays just the title */
.markers-toggle::before {
  content: '▸';
  content: '▸' / '';
  display: inline-block;
  transition: transform 0.25s ease;
}

.markers-toggle.open::before {
  transform: rotate(90deg);
}

@media (hover: hover) {
  .markers-toggle:hover {
    background-color: var(--color-background-soft);
  }

  .marker-row:hover .marker-name,
  .view-all:hover {
    color: var(--color-accent);
    text-decoration: underline;
  }
}

.view-all {
  flex-shrink: 0;
  padding: 6px 8px;
  border: 0;
  background: none;
  color: var(--color-accent);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.markers-body {
  max-height: min(200px, 30vh);
  overflow-y: auto;
  padding: 0 12px 8px;
}

.no-markers {
  color: var(--color-text);
  font-style: italic;
  padding: 8px 0;
}

.markers-list ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.marker-item {
  border-bottom: 1px solid var(--color-border);
}

.marker-item:last-child {
  border-bottom: 0;
}

/* The whole row is the tap target, not just the name */
.marker-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 6px;
  width: 100%;
  padding: 6px 0;
  border: 0;
  background: none;
  color: var(--color-text);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.marker-name {
  color: var(--color-heading);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.marker-row.current .marker-name {
  color: var(--color-accent);
  font-weight: bold;
}

.marker-motion {
  font-size: 13px;
  white-space: nowrap;
}

.marker-motion:empty {
  display: none;
}

.marker-time {
  margin-left: auto;
  padding-left: 8px;
  font-size: 13px;
  white-space: nowrap;
}

.marker-coords {
  background: var(--color-background-mute);
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
}

@container app (max-width: 768px) {
  /* A drawer floating over the bottom of the map */
  .markers-info {
    position: absolute;
    bottom: calc(6px + env(safe-area-inset-bottom));
    left: calc(6px + env(safe-area-inset-left));
    right: calc(6px + env(safe-area-inset-right));
    margin-top: 0;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    z-index: 1000;
  }

  .markers-toggle {
    min-height: var(--touch-target);
    font-size: 16px;
  }

  .view-all {
    min-height: var(--touch-target);
    font-size: 15px;
  }

  .markers-body {
    max-height: calc(40dvh - var(--touch-target));
  }

  .marker-row {
    min-height: var(--touch-target);
    align-content: center;
    font-size: 15px;
  }
}

/* Coordinates add little on a phone; name, motion and time fit one line */
@container app (max-width: 480px) {
  .marker-coords {
    display: none;
  }
}
</style>
