import React, { useEffect, useRef } from 'react'
import { createApp, type Component, type App } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { setupMockEnvironment, type MockScenarioOptions } from './mockService'

export interface VueStoryOptions {
  props?: Record<string, any>
  initialRoute?: string
  mock?: MockScenarioOptions
  setup?: (app: App) => void
}

export const VueStoryWrapper: React.FC<{
  component: Component
  options?: VueStoryOptions
  containerStyle?: React.CSSProperties
}> = ({ component, options = {}, containerStyle }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<App | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const cleanupMock = setupMockEnvironment(options.mock ?? {})

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          name: 'home',
          component: HomeView,
          props: { name: undefined },
        },
        {
          path: '/:name',
          name: 'user',
          component: HomeView,
          props: true,
        },
      ],
    })

    if (options.initialRoute) {
      router.push(options.initialRoute)
    }

    const app = createApp(component, options.props)
    app.use(router)

    if (options.setup) {
      options.setup(app)
    }

    app.mount(containerRef.current)
    appRef.current = app

    return () => {
      app.unmount()
      appRef.current = null
      cleanupMock()
    }
  }, [component, JSON.stringify(options.props), JSON.stringify(options.mock), options.initialRoute])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        minHeight: 0,
        overflow: 'hidden',
        ...containerStyle,
      }}
    />
  )
}
