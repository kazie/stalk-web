<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { isStalking } from '@/services/stalkingService'
import StalkingControls from './StalkingControls.vue'

const expanded = ref(false)
const panel = ref<HTMLElement | null>(null)
const toggle = ref<HTMLButtonElement | null>(null)
const backdrop = ref<HTMLElement | null>(null)

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled)'

// Focus goes to the toggle either way. Open, it's the sheet's header, so focus starts in the
// sheet (not in a text field, which would pop up the on-screen keyboard). Closed from the
// backdrop or Escape, it's the button that opened the sheet.
const setExpanded = (open: boolean): void => {
  expanded.value = open
  toggle.value?.focus()
}

// Only the phone bottom sheet (shown with a backdrop) is modal; the desktop side panel isn't
const isModal = (): boolean =>
  backdrop.value !== null && getComputedStyle(backdrop.value).display !== 'none'

// Keep Tab inside the sheet while it covers the page
const trapFocus = (event: KeyboardEvent): void => {
  const focusable = [...(panel.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) return
  const active = document.activeElement
  const outside = !panel.value?.contains(active)
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault()
    first.focus()
  }
}

const onKeydown = (event: KeyboardEvent): void => {
  // isComposing: Escape cancels an IME composition (Japanese, Chinese...), not the sheet
  if (!expanded.value || event.defaultPrevented || event.isComposing) return
  if (event.key === 'Escape') setExpanded(false)
  else if (event.key === 'Tab' && isModal()) trapFocus(event)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <aside ref="panel" class="stalking-panel" :class="{ expanded }" aria-label="Stalking controls">
    <div
      v-if="expanded"
      ref="backdrop"
      class="stalking-panel-backdrop"
      aria-hidden="true"
      @click="setExpanded(false)"
    />
    <button
      ref="toggle"
      class="stalking-panel-toggle"
      type="button"
      :aria-expanded="expanded"
      :title="expanded ? 'Collapse stalking controls' : 'Expand stalking controls'"
      @click="setExpanded(!expanded)"
    >
      <span v-if="expanded">Hide controls</span>
      <span v-else-if="isStalking" class="sending-label">
        <span class="sending-dot" aria-hidden="true"></span>Sending<span class="visually-hidden">
          location</span
        >
      </span>
      <span v-else>🕵️ Stalk Me</span>
    </button>

    <div v-if="expanded" class="stalking-panel-content">
      <StalkingControls />
    </div>
  </aside>
</template>

<style scoped>
.stalking-panel {
  /* Clear the notch and home bar on tablets and landscape phones */
  --inset-right: env(safe-area-inset-right);
  flex: 0 0 calc(40px + var(--inset-right));
  width: calc(40px + var(--inset-right));
  height: 100%;
  padding: env(safe-area-inset-top) var(--inset-right) env(safe-area-inset-bottom) 0;
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
  flex-basis: calc(320px + var(--inset-right));
  width: calc(320px + var(--inset-right));
}

/* Only used for the mobile bottom sheet */
.stalking-panel-backdrop {
  display: none;
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
  font: inherit;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
}

.stalking-panel:not(.expanded) .stalking-panel-toggle {
  flex: 1;
  writing-mode: vertical-rl;
}

.sending-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-danger-text);
  font-weight: 600;
}

/* Your location is being shared: keep that visible while the controls are hidden */
.sending-dot {
  position: relative;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-danger);
}

/* A ring that grows and fades. Transform and opacity run on the compositor, so the pulse
   doesn't repaint the page every frame while location is being sent. */
.sending-dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--color-danger);
  animation: sending-pulse 1.6s ease-out infinite;
}

@keyframes sending-pulse {
  from {
    transform: scale(1);
    opacity: 0.5;
  }
  to {
    transform: scale(2);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sending-dot::after {
    animation: none;
    opacity: 0;
  }
}

.stalking-panel-content {
  overflow-y: auto;
  padding: 14px;
  border-top: 0;
  background: var(--color-background);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
}

@container app (max-width: 768px) {
  /* Collapsed: a small pill in the top-right corner instead of a strip eating the map's width */
  .stalking-panel {
    position: fixed;
    top: calc(8px + env(safe-area-inset-top));
    right: calc(12px + env(safe-area-inset-right));
    z-index: 1100;
    flex: none;
    width: auto;
    height: auto;
    padding: 0;
    border: 0;
    background: none;
    transition: none;
  }

  .stalking-panel:not(.expanded) .stalking-panel-toggle {
    writing-mode: horizontal-tb;
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid var(--color-border-hover);
    border-radius: 20px;
    background: var(--color-background-soft);
    color: var(--color-heading);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  /* Expanded: a bottom sheet over the map, so the map keeps its full width */
  .stalking-panel.expanded {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    max-height: 85dvh;
  }

  .stalking-panel-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: -1;
    background: rgba(0, 0, 0, 0.4);
  }

  .stalking-panel.expanded .stalking-panel-toggle {
    min-height: var(--touch-target);
    border-radius: 16px 16px 0 0;
    font-size: 16px;
    font-weight: 600;
  }

  .stalking-panel-content {
    flex: 1;
    min-height: 0;
    padding: 14px calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom))
      calc(16px + env(safe-area-inset-left));
    box-shadow: none;
  }
}
</style>
