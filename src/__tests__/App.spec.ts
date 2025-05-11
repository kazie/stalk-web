import { describe, expect, it, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import App from '../App.vue'

// Mock vue-router
vi.mock('vue-router', () => ({
  createRouter: vi.fn(),
  createWebHistory: vi.fn(),
}))

describe('App', () => {
  it('renders properly with shallow mount', () => {
    const wrapper = shallowMount(App, {
      global: {
        stubs: {
          RouterView: true,
        },
      },
    })

    // With shallowMount, RouterView should be stubbed
    expect(wrapper.findComponent({ name: 'router-view' }).exists()).toBe(true)
  })

  it('contains router-view when fully mounted', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterView: true,
        },
      },
    })

    // Check if router-view is included in the template
    expect(wrapper.html()).toContain('router-view-stub')
  })
})
