import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      vueDevTools({
        launchEditor: 'webstorm',
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_DEV_PROXY_TARGET,
          changeOrigin: true,
          // If your API endpoint doesn't start with /api, you can rewrite the path:
          // rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/ws': {
          target: env.VITE_DEV_PROXY_TARGET,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
