import { describe, it, expect, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { h } from 'vue'
import HomeView from '../HomeView.vue'
import MapComponent from '../../components/MapComponent.vue'

// Mock the MapComponent to isolate HomeView testing
vi.mock('../../components/MapComponent.vue', () => ({
  default: {
    name: 'MapComponent',
    render() {
      return h('div', { class: 'mock-map-component' }, 'Mocked Map Component')
    },
  },
}))

describe('HomeView', () => {
  it('renders properly with shallow mount', () => {
    const wrapper = shallowMount(HomeView)

    // Check if the component renders correctly
    expect(wrapper.find('main').exists()).toBe(true)

    // With shallowMount, MapComponent should be stubbed
    expect(wrapper.findComponent({ name: 'MapComponent' }).exists()).toBe(true)
  })

  it('contains MapComponent when fully mounted', async () => {
    // For this test, we'll use a different approach since we mocked the component
    // We'll check if the component tries to render MapComponent

    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          MapComponent: true,
        },
      },
    })

    // Check if MapComponent is included in the template
    expect(wrapper.html()).toContain('map-component-stub')
  })
})
