import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_DEV_PROXY_TARGET
  const wsProxyTarget = env.VITE_DEV_WS_PROXY_TARGET || apiProxyTarget

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
        ...(apiProxyTarget
          ? {
              '/api': {
                target: apiProxyTarget,
                changeOrigin: true,
                // If your API endpoint doesn't start with /api, you can rewrite the path:
                // rewrite: (path) => path.replace(/^\/api/, '')
              },
            }
          : {}),
        ...(wsProxyTarget
          ? {
              '/ws': {
                target: wsProxyTarget,
                changeOrigin: true,
                ws: true,
              },
            }
          : {}),
      },
    },
  }
})
