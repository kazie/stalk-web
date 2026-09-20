import type { SendRate } from './stalkingTypes'

export interface LocationUpdate {
  latitude: number
  longitude: number
}

interface LocationTrackerOptions {
  getSendRate: () => SendRate
  onPosition: (position: LocationUpdate) => void
  onError: (message: string) => void
}

const getPositionErrorMessage = (positionError: GeolocationPositionError): string => {
  switch (positionError.code) {
    case positionError.PERMISSION_DENIED:
      return 'Location permission was denied.'
    case positionError.POSITION_UNAVAILABLE:
      return 'The current location is unavailable.'
    case positionError.TIMEOUT:
      return 'Timed out while getting the current location.'
    default:
      return 'Unable to get the current location.'
  }
}

export const createLocationTracker = ({
  getSendRate,
  onPosition,
  onError,
}: LocationTrackerOptions) => {
  let watchId: number | null = null
  let runToken = 0
  let lastSentAt = 0
  let pendingPosition: LocationUpdate | null = null
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  const clearPendingTimer = (): void => {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
  }

  const publishPendingPosition = (): void => {
    pendingTimer = null
    if (pendingPosition === null) return

    const position = pendingPosition
    pendingPosition = null
    lastSentAt = Date.now()
    onPosition(position)
  }

  const schedulePendingPosition = (token: number): void => {
    const rate = getSendRate()
    if (pendingPosition === null || rate === 'live') return

    clearPendingTimer()
    const elapsed = Date.now() - lastSentAt
    const delay = Math.max(0, rate - elapsed)
    pendingTimer = setTimeout(() => {
      if (token === runToken) publishPendingPosition()
    }, delay)
  }

  const queuePosition = (position: LocationUpdate, token: number): void => {
    if (token !== runToken) return

    const rate = getSendRate()
    if (rate === 'live' || lastSentAt === 0) {
      pendingPosition = position
      publishPendingPosition()
      return
    }

    pendingPosition = position
    schedulePendingPosition(token)
  }

  const stop = (): void => {
    runToken += 1
    if (watchId !== null) {
      navigator.geolocation?.clearWatch(watchId)
      watchId = null
    }
    clearPendingTimer()
    pendingPosition = null
    lastSentAt = 0
  }

  return {
    start(): void {
      if (!navigator.geolocation) {
        onError('This browser does not provide location access.')
        return
      }

      const token = ++runToken
      try {
        watchId = navigator.geolocation.watchPosition(
          (position) =>
            queuePosition(
              { latitude: position.coords.latitude, longitude: position.coords.longitude },
              token,
            ),
          (positionError) => {
            if (token !== runToken) return
            stop()
            onError(getPositionErrorMessage(positionError))
          },
          { enableHighAccuracy: true, maximumAge: 0 },
        )
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Unable to start location access.')
      }
    },

    stop,

    setRate(): void {
      if (getSendRate() === 'live') {
        clearPendingTimer()
        if (pendingPosition !== null) publishPendingPosition()
      } else if (pendingPosition !== null) {
        schedulePendingPosition(runToken)
      }
    },
  }
}
