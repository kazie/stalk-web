import { afterEach, describe, expect, it, vi } from 'vitest'
import { fallbackUrl, hasWebGL } from '../webglSupport'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

const mockGetContext = (impl: (id: string) => unknown) =>
  vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(impl as HTMLCanvasElement['getContext'])

describe('hasWebGL', () => {
  it('is true when a webgl2 context can be created', () => {
    mockGetContext((id) => (id === 'webgl2' ? {} : null))
    expect(hasWebGL()).toBe(true)
  })

  it('falls back to webgl1', () => {
    mockGetContext((id) => (id === 'webgl' ? {} : null))
    expect(hasWebGL()).toBe(true)
  })

  it('is false when no context can be created', () => {
    mockGetContext(() => null)
    expect(hasWebGL()).toBe(false)
  })

  it('is false when creating a context throws', () => {
    mockGetContext(() => {
      throw new Error('blocked')
    })
    expect(hasWebGL()).toBe(false)
  })
})

describe('fallbackUrl', () => {
  it('returns the configured url', () => {
    vi.stubEnv('VITE_FALLBACK_URL', 'https://old.example.com')
    expect(fallbackUrl()).toBe('https://old.example.com')
  })

  it('is undefined when unset or blank', () => {
    vi.stubEnv('VITE_FALLBACK_URL', '  ')
    expect(fallbackUrl()).toBeUndefined()
  })
})
