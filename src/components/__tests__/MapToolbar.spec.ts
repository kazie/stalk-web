import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MapToolbar from '../MapToolbar.vue'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('MapToolbar', () => {
  it('links to the new version when VITE_MODERN_URL is set', () => {
    vi.stubEnv('VITE_MODERN_URL', 'https://example.com')
    const wrapper = mount(MapToolbar, { props: { currentName: null } })

    expect(wrapper.find('a.modern-link').attributes('href')).toBe('https://example.com')
  })

  it('hides the link when VITE_MODERN_URL is unset', () => {
    vi.stubEnv('VITE_MODERN_URL', '')
    const wrapper = mount(MapToolbar, { props: { currentName: null } })

    expect(wrapper.find('a.modern-link').exists()).toBe(false)
  })
})
