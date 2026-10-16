<script setup lang="ts">
defineProps<{
  fallbackUrl?: string
}>()
</script>

<template>
  <main class="webgl-unsupported">
    <h1>Your browser doesn't support WebGL</h1>
    <p>The map needs WebGL, which is unavailable or disabled in this browser.</p>
    <a v-if="fallbackUrl" class="fallback-link" :href="fallbackUrl">
      Continue to the classic version
    </a>
  </main>
</template>

<style scoped>
.webgl-unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 100dvh;
  padding: 16px;
  text-align: center;
}

.fallback-link {
  padding: 8px 16px;
  border-radius: 4px;
  background-color: #42b983;
  color: white;
  text-decoration: none;
}

.fallback-link:hover {
  background-color: #379e70;
}
</style>
