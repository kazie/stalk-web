<script setup lang="ts">
import MapComponent from '../components/MapComponent.vue'
</script>

<template>
  <main class="home-view">
    <MapComponent />
  </main>
</template>

<style scoped>
.home-view {
  width: 100%;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
