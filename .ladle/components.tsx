import React from 'react'
import type { GlobalProvider } from '@ladle/react'
import '../src/assets/main.css'
import 'leaflet/dist/leaflet.css'
import './ladle-override.css'

export const Provider: GlobalProvider = ({ children }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flex: '1 1 0%',
        minHeight: 0,
      }}
    >
      {children}
    </div>
  )
}
