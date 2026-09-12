import React, { useEffect, useRef } from 'react'
import { createApp, h, type Component, type App } from 'vue'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
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

    const routeProps = (route: { params: Record<string, string | string[]> }) => ({
      ...options.props,
      ...(typeof route.params.name === 'string' ? { name: route.params.name } : {}),
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          name: 'home',
          component,
          props: () => ({ ...options.props, name: undefined }),
        },
        {
          path: '/:name',
          name: 'user',
          component,
          props: routeProps,
        },
      ],
    })

    void router.push(options.initialRoute ?? '/')

    const app = createApp({ render: () => h(RouterView) })
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
