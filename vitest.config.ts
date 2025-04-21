import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

// Create a config object from the vite config function
const resolvedViteConfig = viteConfig({
  mode: 'test',
  command: 'serve'
})

export default mergeConfig(
  resolvedViteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      coverage: {
        // you can include other reporters, but 'json-summary' is required, json is recommended
        reporter: ['text', 'json-summary', 'json'],
        // If you want a coverage reports even if your tests are failing, include the reportOnFailure option
        reportOnFailure: true,
        exclude: [
          ...(configDefaults.coverage?.exclude ?? []),
          'src/main.ts'
        ]
      }
    },
  }),
)
