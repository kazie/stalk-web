import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_DEV_PROXY_TARGET
  const wsProxyTarget = env.VITE_DEV_WS_PROXY_TARGET || apiProxyTarget
  const requiredEnvironment =
    command === 'serve' && mode !== 'test'
      ? (['VITE_API_ENDPOINT', 'VITE_DEV_PROXY_TARGET'] as const)
      : (['VITE_API_ENDPOINT'] as const)
  const missingEnvironment = requiredEnvironment.filter((name) => !env[name]?.trim())

  if (missingEnvironment.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvironment.join(', ')}`)
  }

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
          target: apiProxyTarget,
          changeOrigin: true,
          // If your API endpoint doesn't start with /api, you can rewrite the path:
          // rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/ws': {
          target: wsProxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
