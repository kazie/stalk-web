import { ACCEPT_HEADER, toApiError } from './apiError'
import type { LocationUpdate } from './stalkingLocation'

export { ApiError as StalkingApiError } from './apiError'

export type LocationPayload = LocationUpdate & { name: string }

const apiEndpoint = import.meta.env.VITE_API_ENDPOINT

export const publishLocation = async (apiKey: string, payload: LocationPayload): Promise<void> => {
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: ACCEPT_HEADER,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw await toApiError(response)
}

export const hasStalkingData = async (name: string): Promise<boolean> => {
  const response = await fetch(`${apiEndpoint}/${encodeURIComponent(name)}`)
  if (response.status === 404) return false
  if (!response.ok) throw await toApiError(response)
  return true
}

export const deleteLocation = async (apiKey: string, name: string): Promise<void> => {
  const response = await fetch(`${apiEndpoint}/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: ACCEPT_HEADER,
    },
  })

  if (!response.ok) throw await toApiError(response)
}
