import './assets/main.css'

import { createApp } from 'vue'
import WebGLUnsupported from './components/WebGLUnsupported.vue'
import { fallbackUrl, hasWebGL } from './services/webglSupport'

if (hasWebGL()) {
  // Loaded lazily so browsers without WebGL never download the map renderer.
  const [{ default: App }, { default: router }] = await Promise.all([
    import('./App.vue'),
    import('./router'),
  ])
  createApp(App).use(router).mount('#app')
} else {
  createApp(WebGLUnsupported, { fallbackUrl: fallbackUrl() }).mount('#app')
}
