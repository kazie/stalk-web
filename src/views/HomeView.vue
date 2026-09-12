<script setup lang="ts">
import MapComponent from '../components/MapComponent.vue'
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <main class="home-view">
    <MapComponent :name="route.params.name as string" />
  </main>
</template>

<style scoped>
.home-view {
  width: 100%;
  height: 100%;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex: 1;
}
</style>
