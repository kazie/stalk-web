<script setup lang="ts">
import { ref } from 'vue'
import StalkingControls from './StalkingControls.vue'

const expanded = ref(false)

const togglePanel = (): void => {
  expanded.value = !expanded.value
}
</script>

<template>
  <aside class="stalking-panel" :class="{ expanded }" aria-label="Stalking controls">
    <button
      class="stalking-panel-toggle"
      type="button"
      :aria-expanded="expanded"
      :title="expanded ? 'Collapse stalking controls' : 'Expand stalking controls'"
      @click="togglePanel"
    >
      <span>{{ expanded ? 'Hide controls' : '🕵️ Stalk Me' }}</span>
    </button>

    <div v-if="expanded" class="stalking-panel-content">
      <StalkingControls />
    </div>
  </aside>
</template>

<style scoped>
.stalking-panel {
  flex: 0 0 40px;
  width: 40px;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text);
  transition:
    flex-basis 0.2s ease,
    width 0.2s ease;
}

.stalking-panel.expanded {
  flex-basis: 320px;
  width: 320px;
}

.stalking-panel-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 40px;
  padding: 6px;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
}

.stalking-panel:not(.expanded) .stalking-panel-toggle {
  flex: 1;
  writing-mode: vertical-rl;
}

.stalking-panel-content {
  overflow-y: auto;
  padding: 14px;
  border-top: 0;
  background: var(--color-background);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
}
</style>
