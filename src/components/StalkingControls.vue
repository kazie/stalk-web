<script setup lang="ts">
import { useStalkingPanel } from '@/composables/useStalkingPanel'

const {
  apiKey,
  canDelete,
  isCheckingStalkingData,
  isDeleting,
  isStalking,
  onDelete,
  onSendRateChange,
  sendRate,
  stalkingError,
  stalkingName,
  toggleStalking,
} = useStalkingPanel()
</script>

<template>
  <h2>Send your location</h2>

  <label for="stalking-api-key">API key</label>
  <input
    id="stalking-api-key"
    v-model="apiKey"
    type="password"
    autocomplete="off"
    :disabled="isStalking"
  />

  <label for="stalking-name">Name</label>
  <input id="stalking-name" v-model="stalkingName" type="text" :disabled="isStalking" />

  <label for="stalking-send-rate">Send at most</label>
  <select id="stalking-send-rate" v-model="sendRate" @change="onSendRateChange">
    <option value="live">LIVE</option>
    <option :value="1000">1 second</option>
    <option :value="5000">5 seconds</option>
    <option :value="10000">10 seconds</option>
  </select>

  <div class="stalking-panel-actions">
    <button
      class="start-stalking-button"
      :class="{ active: isStalking }"
      type="button"
      @click="toggleStalking"
    >
      {{ isStalking ? 'Stop stalking' : 'Start stalking' }}
    </button>
    <button class="delete-stalking-button" type="button" :disabled="!canDelete" @click="onDelete">
      {{ isCheckingStalkingData ? 'Checking…' : isDeleting ? 'Deleting…' : 'Delete data' }}
    </button>
  </div>

  <p v-if="isStalking" class="stalking-status" role="status">Stalking is active.</p>
  <p v-if="stalkingError" class="stalking-error" role="alert">{{ stalkingError }}</p>
</template>

<style scoped>
h2 {
  margin: 0 0 12px;
  font-size: 18px;
}

label {
  display: block;
  margin-top: 10px;
  font-size: 13px;
  font-weight: 600;
}

input,
select {
  width: 100%;
  margin-top: 4px;
  padding: 7px 8px;
  border: 1px solid var(--color-border-hover);
  border-radius: 4px;
  background: var(--color-background-soft);
  color: var(--color-heading);
  font: inherit;
}

.stalking-panel-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.stalking-panel-actions button {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 4px;
  color: white;
  font: inherit;
  cursor: pointer;
}

.start-stalking-button {
  background: var(--color-accent);
}

.start-stalking-button.active,
.delete-stalking-button {
  background: var(--color-danger);
}

.delete-stalking-button:disabled {
  background: var(--color-background-soft);
  border-color: var(--color-border);
  color: var(--color-text);
}

.stalking-panel-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.stalking-status,
.stalking-error {
  margin: 10px 0 0;
  font-size: 13px;
}

.stalking-status {
  color: var(--color-success-text);
}

.stalking-error {
  color: var(--color-danger-text);
}

@container app (max-width: 768px) {
  /* 16px stops iOS zooming in on focus; 44px is a comfortable touch target */
  input,
  select,
  .stalking-panel-actions button {
    min-height: var(--touch-target);
    font-size: 16px;
  }

  label {
    font-size: 14px;
  }
}
</style>
