import React from 'react'
import type { Story } from '@ladle/react'
import { VueStoryWrapper, type VueStoryOptions } from './VueStoryWrapper'
import MapComponent from '../components/MapComponent.vue'
import { SAMPLE_MARKERS, CLUSTERED_MARKERS, MOUNTAIN_MARKERS } from './mockService'
import { ZoomLevel, UpdateMode } from '../services/markerService'

// The map filling the whole story area.
const MapStory: React.FC<{ options: VueStoryOptions }> = ({ options }) => (
  <VueStoryWrapper component={MapComponent} options={options} />
)

export const Everyone: Story = () => (
  <MapStory
    options={{
      mock: {
        initialMarkers: SAMPLE_MARKERS,
        freeRoaming: false,
        mode: UpdateMode.Live,
      },
    }}
  />
)
Everyone.storyName = 'Overview (Everyone)'

export const SingleTargetKazie: Story = () => (
  <MapStory
    options={{
      props: { name: 'kazie' },
      initialRoute: '/kazie',
      mock: {
        currentName: 'kazie',
        initialMarkers: SAMPLE_MARKERS,
        zoomLevel: ZoomLevel.Close,
      },
    }}
  />
)
SingleTargetKazie.storyName = 'Single Target (Kazie)'

export const LiveMovementSimulation: Story = () => (
  <MapStory
    options={{
      mock: {
        initialMarkers: SAMPLE_MARKERS,
        simulateMovement: true,
        movementIntervalMs: 1200,
        freeRoaming: false,
      },
    }}
  />
)
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
          backgroundColor: 'var(--color-background)',
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
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-heading)',
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

        <MapStory
          options={{
            mock: {
              initialMarkers: SAMPLE_MARKERS,
              freeRoaming: false,
            },
          }}
        />
      </div>
    </div>
  )
}
MobileView.storyName = 'Mobile Device View (iPhone 390px)'

export const ClusteredCityTargets: Story = () => (
  <MapStory
    options={{
      mock: {
        initialMarkers: CLUSTERED_MARKERS,
        freeRoaming: false,
        zoomLevel: ZoomLevel.Medium,
      },
    }}
  />
)
ClusteredCityTargets.storyName = 'Clustered Targets (Stockholm)'

export const EmptyStateNoTargets: Story = () => (
  <MapStory
    options={{
      mock: {
        initialMarkers: [],
        freeRoaming: true,
      },
    }}
  />
)

export const ErrorState: Story = () => (
  <MapStory
    options={{
      mock: {
        initialMarkers: [],
        error:
          'Failed to establish connection to tracking backend (/api/coords: 500 Internal Error)',
        mode: UpdateMode.Poll,
      },
    }}
  />
)
ErrorState.storyName = 'Error State (Backend Failure)'

export const NoWebGL: Story = () => (
  <MapStory options={{ mock: { initialMarkers: SAMPLE_MARKERS, noWebGL: true } }} />
)
NoWebGL.storyName = 'No WebGL (Old Devices)'

// Tilt with right-drag (or two-finger drag) to see the 3D terrain.
export const MountainsElevation: Story = () => (
  <MapStory
    options={{
      mock: {
        initialMarkers: MOUNTAIN_MARKERS,
        freeRoaming: false,
        mapStyle: 'Vector: Liberty',
        elevation: true,
      },
    }}
  />
)
MountainsElevation.storyName = 'Mountains (Elevation On)'
