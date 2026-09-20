import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import {
  apiKey,
  checkStalkingData,
  deleteStalkingData,
  isDeleting,
  isStalking,
  sendRate,
  setSendRate,
  stalkingDataExists,
  stalkingError,
  stalkingName,
  startStalking,
  stopStalking,
} from '../stalkingService'
import { markers } from '../markerService'

const watchPosition = vi.fn()
const clearWatch = vi.fn()

const response = (ok = true, status = 200) => ({ ok, status })

const deferredResponse = () => {
  let resolve!: (response: Response) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<Response>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('stalkingService', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch },
    })
    watchPosition.mockReset()
    clearWatch.mockReset()
    watchPosition.mockReturnValue(42)
    localStorage.clear()
    apiKey.value = 'test-token'
    stalkingName.value = 'Alice'
    sendRate.value = 'live'
    isStalking.value = false
    stalkingDataExists.value = false
    stalkingError.value = null
    markers.value = []
    stopStalking()
  })

  afterEach(() => {
    stopStalking()
    vi.useRealTimers()
  })

  it('starts watching and publishes each live position', async () => {
    startStalking()

    expect(isStalking.value).toBe(true)
    expect(watchPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      maximumAge: 0,
    })

    const success = watchPosition.mock.calls[0][0]
    success({ coords: { latitude: 59.3, longitude: 18.1 } })
    await Promise.resolve()
    await Promise.resolve()

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        body: JSON.stringify({ name: 'Alice', latitude: 59.3, longitude: 18.1 }),
      }),
    )
    expect(stalkingDataExists.value).toBe(true)
  })

  it('limits updates and sends the newest pending position', async () => {
    vi.useFakeTimers()
    setSendRate(5000)
    startStalking()
    const success = watchPosition.mock.calls[0][0]

    success({ coords: { latitude: 1, longitude: 1 } })
    await vi.runAllTicks()
    success({ coords: { latitude: 2, longitude: 2 } })
    success({ coords: { latitude: 3, longitude: 3 } })
    expect(fetch).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(4999)
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    await vi.runAllTicks()

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ name: 'Alice', latitude: 3, longitude: 3 }),
      }),
    )
  })

  it('stops the browser watch', () => {
    startStalking()
    stopStalking()

    expect(isStalking.value).toBe(false)
    expect(clearWatch).toHaveBeenCalledWith(42)
  })

  it('keeps stalking active when a publish fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(false, 401) as Response)
    startStalking()
    const success = watchPosition.mock.calls[0][0]
    success({ coords: { latitude: 1, longitude: 2 } })
    await Promise.resolve()
    await Promise.resolve()

    expect(isStalking.value).toBe(true)
    expect(stalkingError.value).toBe('API request failed with status 401')
  })

  it('stops when browser location access fails', () => {
    startStalking()
    const locationError = watchPosition.mock.calls[0][1]

    locationError({
      code: 1,
      message: 'permission denied',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError)

    expect(isStalking.value).toBe(false)
    expect(clearWatch).toHaveBeenCalledWith(42)
    expect(stalkingError.value).toBe('Location permission was denied.')
  })

  it('persists the API key and name', async () => {
    apiKey.value = 'saved-token'
    stalkingName.value = 'Saved Name'
    await nextTick()

    expect(localStorage.getItem('stalk.apiKey')).toBe('saved-token')
    expect(localStorage.getItem('stalk.name')).toBe('Saved Name')
  })

  it('deletes the named server data and removes its local marker', async () => {
    stalkingDataExists.value = true
    markers.value = [
      { name: 'Alice', latitude: 1, longitude: 2, timestamp: '2025-01-01T00:00:00Z' },
      { name: 'Bob', latitude: 3, longitude: 4, timestamp: '2025-01-01T00:00:00Z' },
    ]

    const deleted = await deleteStalkingData()

    expect(deleted).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/Alice'),
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    )
    expect(markers.value.map((marker) => marker.name)).toEqual(['Bob'])
  })

  it.each([false, true])(
    'waits for all publishes before deleting (publish fails: %s)',
    async (fails) => {
      const first = deferredResponse()
      const second = deferredResponse()
      const deletion = deferredResponse()
      const endpoint = import.meta.env.VITE_API_ENDPOINT
      let postCount = 0
      vi.mocked(fetch).mockImplementation(async (url, options) => {
        if (url === endpoint && options?.method === 'POST') {
          return postCount++ === 0 ? first.promise : second.promise
        }
        if (url === `${endpoint}/Alice` && options?.method === 'DELETE') {
          return deletion.promise
        }
        throw new Error(`Unexpected request: ${options?.method} ${url}`)
      })
      stalkingDataExists.value = true
      startStalking()
      const success = watchPosition.mock.calls[0][0]
      success({ coords: { latitude: 1, longitude: 2 } })
      success({ coords: { latitude: 3, longitude: 4 } })
      stopStalking()

      const deleting = deleteStalkingData()
      expect(isDeleting.value).toBe(true)
      startStalking()
      expect(isStalking.value).toBe(false)
      expect(await deleteStalkingData()).toBe(false)
      await flushPromises()
      expect(fetch).toHaveBeenCalledTimes(2)

      // Complete the newer request first: deletion must also wait for the older one.
      second.resolve(response() as Response)
      await flushPromises()
      expect(fetch).toHaveBeenCalledTimes(2)
      if (fails) first.reject(new Error('Network error'))
      else first.resolve(response() as Response)
      await flushPromises()
      expect(fetch).toHaveBeenCalledTimes(3)
      expect(fetch).toHaveBeenLastCalledWith(
        `${endpoint}/Alice`,
        expect.objectContaining({ method: 'DELETE' }),
      )
      expect(isDeleting.value).toBe(true)
      startStalking()
      expect(isStalking.value).toBe(false)

      deletion.resolve(response() as Response)
      expect(await deleting).toBe(true)
      expect(isDeleting.value).toBe(false)
      expect(stalkingDataExists.value).toBe(false)
      expect(stalkingError.value).toBeNull()
    },
  )

  it('only considers stalking data deletable when the name exists', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(false, 404) as Response)
    await checkStalkingData('Missing')
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/Missing'))
    expect(stalkingDataExists.value).toBe(false)

    vi.mocked(fetch).mockResolvedValueOnce(response(true, 200) as Response)
    await checkStalkingData('Alice')
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/Alice'))
    expect(stalkingDataExists.value).toBe(true)
  })
})
