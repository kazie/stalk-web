import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocationTracker, toLocationUpdate, type LocationUpdate } from '../stalkingLocation'

const watchPosition = vi.fn()
const clearWatch = vi.fn()

const coords = (overrides: Partial<GeolocationCoordinates> = {}) => ({
  latitude: 59.3,
  longitude: 18.1,
  speed: null,
  heading: null,
  ...overrides,
})

describe('stalkingLocation', () => {
  let onPosition: ReturnType<typeof vi.fn<(position: LocationUpdate) => void>>
  let tracker: ReturnType<typeof createLocationTracker>

  const emit = (overrides: Partial<GeolocationCoordinates> = {}): void => {
    const success = watchPosition.mock.calls[0]![0]
    success({ coords: coords(overrides) })
  }

  beforeEach(() => {
    watchPosition.mockReset()
    clearWatch.mockReset()
    watchPosition.mockReturnValue(1)
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch },
    })
    onPosition = vi.fn()
    tracker = createLocationTracker({ getSendRate: () => 'live', onPosition, onError: vi.fn() })
    tracker.start()
  })

  afterEach(() => {
    tracker.stop()
  })

  it('forwards valid speed and heading', () => {
    emit({ speed: 8.3, heading: 45 })

    expect(onPosition).toHaveBeenCalledWith({
      latitude: 59.3,
      longitude: 18.1,
      speed: 8.3,
      heading: 45,
    })
  })

  describe('toLocationUpdate', () => {
    const update = (overrides: Partial<GeolocationCoordinates>) =>
      toLocationUpdate(coords(overrides) as GeolocationCoordinates)

    it('drops null speed and NaN heading', () => {
      expect(update({ speed: null, heading: NaN })).toStrictEqual({
        latitude: 59.3,
        longitude: 18.1,
      })
    })

    it('drops negative and non-finite speed', () => {
      expect(update({ speed: -1, heading: Infinity })).toStrictEqual({
        latitude: 59.3,
        longitude: 18.1,
      })
      expect(update({ speed: Infinity, heading: 90 })).toStrictEqual({
        latitude: 59.3,
        longitude: 18.1,
        heading: 90,
      })
    })

    it('drops out-of-range headings such as the -1 invalid value', () => {
      expect(update({ speed: 5, heading: -1 })).toStrictEqual({
        latitude: 59.3,
        longitude: 18.1,
        speed: 5,
      })
      expect(update({ heading: 361 })).toStrictEqual({ latitude: 59.3, longitude: 18.1 })
    })

    it('keeps zero speed and normalises the heading into [0, 360)', () => {
      expect(update({ speed: 0, heading: 360 })).toStrictEqual({
        latitude: 59.3,
        longitude: 18.1,
        speed: 0,
        heading: 0,
      })
    })
  })
})
