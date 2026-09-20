import { ref, watch } from 'vue'
import { removeMarkerByName } from './markerService'
import { deleteLocation, hasStalkingData, publishLocation, StalkingApiError } from './stalkingApi'
import { createLocationTracker, type LocationUpdate } from './stalkingLocation'
import type { SendRate } from './stalkingTypes'

export type { SendRate } from './stalkingTypes'

const apiKeyStorageKey = 'stalk.apiKey'
const nameStorageKey = 'stalk.name'

const readStorage = (key: string): string => {
  try {
    return window.localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

const writeStorage = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}

export const apiKey = ref(readStorage(apiKeyStorageKey))
export const stalkingName = ref(readStorage(nameStorageKey))
export const sendRate = ref<SendRate>('live')
export const isStalking = ref(false)
export const isDeleting = ref(false)
export const isCheckingStalkingData = ref(false)
export const stalkingDataExists = ref(false)
export const stalkingError = ref<string | null>(null)

watch(apiKey, (value) => writeStorage(apiKeyStorageKey, value))
watch(stalkingName, (value) => writeStorage(nameStorageKey, value))

let runToken = 0
let activeName = ''
let activeApiKey = ''
let lookupToken = 0
const pendingPublishes = new Set<Promise<void>>()

const sendPosition = async (position: LocationUpdate, token: number): Promise<void> => {
  try {
    await publishLocation(activeApiKey, {
      name: activeName,
      latitude: position.latitude,
      longitude: position.longitude,
    })

    if (token === runToken) {
      stalkingError.value = null
      stalkingDataExists.value = true
    }
  } catch (error) {
    if (token === runToken) {
      stalkingError.value = error instanceof Error ? error.message : 'Unable to send location.'
    }
  }
}

const locationTracker = createLocationTracker({
  getSendRate: () => sendRate.value,
  onPosition: (position) => {
    const publish = sendPosition(position, runToken)
    pendingPublishes.add(publish)
    void publish.finally(() => pendingPublishes.delete(publish))
  },
  onError: (message) => {
    runToken += 1
    isStalking.value = false
    stalkingError.value = message
  },
})

export const setSendRate = (rate: SendRate): void => {
  sendRate.value = rate
  locationTracker.setRate()
}

export const startStalking = (): void => {
  if (isStalking.value || isDeleting.value) return

  const name = stalkingName.value.trim()
  const key = apiKey.value.trim()
  stalkingName.value = name
  apiKey.value = key

  if (!key || !name) {
    stalkingError.value = 'Enter an API key and name before starting.'
    return
  }

  activeName = name
  activeApiKey = key
  stalkingError.value = null
  runToken += 1
  isStalking.value = true
  locationTracker.start()
}

export const stopStalking = (): void => {
  runToken += 1
  locationTracker.stop()
  isStalking.value = false
}

export const deleteStalkingData = async (): Promise<boolean> => {
  if (isStalking.value || isDeleting.value || !stalkingDataExists.value) return false

  const name = stalkingName.value.trim()
  const key = apiKey.value.trim()
  if (!key || !name) {
    stalkingError.value = 'Enter an API key and name before deleting data.'
    return false
  }

  isDeleting.value = true
  stalkingError.value = null

  try {
    // Stopping the watch does not cancel POSTs already sent to the server.
    // Drain them before DELETE so a late POST cannot recreate the location.
    await Promise.allSettled(pendingPublishes)
    await deleteLocation(key, name)
    removeMarkerByName(name)
    stalkingDataExists.value = false
    return true
  } catch (error) {
    if (error instanceof StalkingApiError && error.status === 404) {
      stalkingDataExists.value = false
    }
    stalkingError.value = error instanceof Error ? error.message : 'Unable to delete stalking data.'
    return false
  } finally {
    isDeleting.value = false
  }
}

export const checkStalkingData = async (name = stalkingName.value): Promise<void> => {
  const normalizedName = name.trim()
  const token = ++lookupToken
  stalkingDataExists.value = false
  if (!normalizedName) {
    isCheckingStalkingData.value = false
    return
  }

  isCheckingStalkingData.value = true
  try {
    const exists = await hasStalkingData(normalizedName)
    if (token !== lookupToken) return
    stalkingDataExists.value = exists
  } catch (error) {
    if (token !== lookupToken) return
    stalkingError.value = error instanceof Error ? error.message : 'Unable to check stalking data.'
  } finally {
    if (token === lookupToken) isCheckingStalkingData.value = false
  }
}
