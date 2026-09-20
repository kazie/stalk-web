export interface LocationPayload {
  name: string
  latitude: number
  longitude: number
}

const apiEndpoint = import.meta.env.VITE_API_ENDPOINT

export class StalkingApiError extends Error {
  constructor(public readonly status: number) {
    super(`API request failed with status ${status}`)
    this.name = 'StalkingApiError'
  }
}

export const publishLocation = async (apiKey: string, payload: LocationPayload): Promise<void> => {
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new StalkingApiError(response.status)
}

export const hasStalkingData = async (name: string): Promise<boolean> => {
  const response = await fetch(`${apiEndpoint}/${encodeURIComponent(name)}`)
  if (response.status === 404) return false
  if (!response.ok) throw new StalkingApiError(response.status)
  return true
}

export const deleteLocation = async (apiKey: string, name: string): Promise<void> => {
  const response = await fetch(`${apiEndpoint}/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) throw new StalkingApiError(response.status)
}
