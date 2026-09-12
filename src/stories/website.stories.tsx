import React from 'react'
import type { Story } from '@ladle/react'
import { VueStoryWrapper } from './VueStoryWrapper'
import MapComponent from '../components/MapComponent.vue'
import { SAMPLE_MARKERS, CLUSTERED_MARKERS } from './mockService'
import { ZoomLevel, UpdateMode } from '../services/markerService'

export const Everyone: Story = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <VueStoryWrapper
        component={MapComponent}
        options={{
          mock: {
            initialMarkers: SAMPLE_MARKERS,
            freeRoaming: false,
            mode: UpdateMode.Live,
          },
        }}
        containerStyle={{ height: '100%', flex: '1 1 0%', minHeight: 0 }}
      />
    </div>
  )
}
Everyone.storyName = 'Overview (Everyone)'

export const SingleTargetKazie: Story = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <VueStoryWrapper
        component={MapComponent}
        options={{
          props: { name: 'kazie' },
          initialRoute: '/kazie',
          mock: {
            currentName: 'kazie',
            initialMarkers: SAMPLE_MARKERS,
            zoomLevel: ZoomLevel.Close,
          },
        }}
        containerStyle={{ height: '100%', flex: '1 1 0%', minHeight: 0 }}
      />
    </div>
  )
}
SingleTargetKazie.storyName = 'Single Target (Kazie)'

export const LiveMovementSimulation: Story = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <VueStoryWrapper
        component={MapComponent}
        options={{
          mock: {
            initialMarkers: SAMPLE_MARKERS,
            simulateMovement: true,
            movementIntervalMs: 1200,
            freeRoaming: false,
          },
        }}
        containerStyle={{ height: '100%', flex: '1 1 0%', minHeight: 0 }}
      />
    </div>
  )
}
LiveMovementSimulation.storyName = 'Live Simulation (Moving Targets)'

export const MobileView: Story = () => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        flex: '1 1 0%',
        minHeight: 0,
        backgroundColor: '#1e1e24',
        padding: '12px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '390px',
          maxWidth: '100%',
          height: '100%',
          maxHeight: '800px',
          backgroundColor: '#fff',
          borderRadius: '36px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 12px #2d2d30',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Mock Mobile Status Bar */}
        <div
          style={{
            height: '28px',
            backgroundColor: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 20px',
            fontSize: '12px',
            fontWeight: '600',
            zIndex: 2000,
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <span>09:41</span>
          <div
            style={{ width: '80px', height: '16px', background: '#000', borderRadius: '10px' }}
          />
          <span>5G 100%</span>
        </div>

        <div
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <VueStoryWrapper
            component={MapComponent}
            options={{
              mock: {
                initialMarkers: SAMPLE_MARKERS,
                freeRoaming: false,
              },
            }}
            containerStyle={{ height: '100%', flex: '1 1 0%', minHeight: 0 }}
          />
        </div>
      </div>
    </div>
  )
}
MobileView.storyName = 'Mobile Device View (iPhone 390px)'

export const ClusteredCityTargets: Story = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <VueStoryWrapper
        component={MapComponent}
        options={{
          mock: {
            initialMarkers: CLUSTERED_MARKERS,
            freeRoaming: false,
            zoomLevel: ZoomLevel.Medium,
          },
        }}
        containerStyle={{ height: '100%', flex: '1 1 0%', minHeight: 0 }}
      />
    </div>
  )
}
ClusteredCityTargets.storyName = 'Clustered Targets (Stockholm)'

export const EmptyStateNoTargets: Story = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <VueStoryWrapper
        component={MapComponent}
        options={{
          mock: {
            initialMarkers: [],
            freeRoaming: true,
          },
        }}
        containerStyle={{ height: '100%', flex: '1 1 0%', minHeight: 0 }}
      />
    </div>
  )
}

export const ErrorState: Story = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <VueStoryWrapper
        component={MapComponent}
        options={{
          mock: {
            initialMarkers: [],
            error:
              'Failed to establish connection to tracking backend (/api/coords: 500 Internal Error)',
          },
        }}
        containerStyle={{ height: '100%', flex: '1 1 0%', minHeight: 0 }}
      />
    </div>
  )
}
ErrorState.storyName = 'Error State (Backend Failure)'
