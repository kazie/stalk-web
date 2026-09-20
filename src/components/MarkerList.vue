<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { MarkerData } from '@/services/markerService'
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

onMounted(() => {
  relativeTimeTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (relativeTimeTimer !== null) clearInterval(relativeTimeTimer)
})
</script>

<template>
  <div class="markers-info" :class="{ collapsed: !props.expanded }">
    <div
      class="markers-header"
      role="button"
      tabindex="0"
      :aria-expanded="props.expanded"
      @click="emit('toggle')"
      @keydown.enter.self="emit('toggle')"
      @keydown.space.self.prevent="emit('toggle')"
    >
      <h3>
        Current Markers ({{ props.markers.length }})
        <span v-if="props.currentName" class="view-all" @click.stop="emit('navigate', null)">
          View All
        </span>
      </h3>
      <button
        class="menu-toggle-btn"
        type="button"
        :aria-label="props.expanded ? 'Collapse markers menu' : 'Expand markers menu'"
        @click.stop="emit('toggle')"
      >
        <span class="chevron" :class="{ open: props.expanded }">▾</span>
      </button>
    </div>
    <div v-show="props.expanded" class="markers-body">
      <div v-if="props.markers.length === 0 && !props.isLoading" class="no-markers">
        No markers available
      </div>
      <div v-else class="markers-list">
        <ul>
          <li v-for="marker in props.markers" :key="marker.name" class="marker-item">
            <span class="marker-item-main">
              <strong
                class="marker-name"
                :class="{ current: marker.name === props.currentName }"
                @click="emit('navigate', marker.name)"
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
</template>

<style scoped>
.markers-info {
  margin-top: 16px;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-background);
  display: flex;
  flex-direction: column;
  transition: max-height 0.3s ease;
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
  flex-shrink: 0;
}

.markers-header:hover {
  background-color: var(--color-background-soft);
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
  color: var(--color-text);
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
  padding: 4px 12px 12px;
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
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
  color: var(--color-text);
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
  background: var(--color-background-mute);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  word-break: break-all;
}

.marker-time {
  font-size: 13px;
  color: var(--color-text);
  white-space: nowrap;
}

.marker-name {
  cursor: pointer;
  color: var(--color-heading);
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
}

.view-all:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .markers-info {
    position: absolute;
    bottom: 6px;
    left: 6px;
    right: 6px;
    margin-top: 0;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    background: var(--color-background);
    z-index: 1000;
  }

  .markers-header {
    min-height: 44px;
  }

  .marker-item {
    min-height: 44px;
  }
}
</style>
