import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { h } from 'vue'
import HomeView from '../HomeView.vue'
import type { RouteLocationNormalizedGeneric } from 'vue-router'
import { useRoute } from 'vue-router'

// Mock the MapComponent to isolate HomeView testing
vi.mock('../../components/MapComponent.vue', () => ({
  default: {
    name: 'MapComponent',
    props: ['name'],
    render() {
      return h(
        'div',
        { class: 'mock-map-component' },
        `Mocked Map Component: ${this.name || 'no name'}`,
      )
    },
  },
}))

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: vi.fn(),
}))

describe('HomeView', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks()
  })

  it('renders properly with shallow mount', () => {
    // Mock useRoute to return a route with no name parameter
    vi.mocked(useRoute).mockReturnValue({
      params: {},
      path: '/',
      name: 'home',
      fullPath: '/',
      query: {},
      hash: '',
      matched: [],
      meta: {},
      redirectedFrom: undefined,
    } as RouteLocationNormalizedGeneric)

    const wrapper = shallowMount(HomeView)

    // Check if the component renders correctly
    expect(wrapper.find('main').exists()).toBe(true)

    // With shallowMount, MapComponent should be stubbed
    const mapComponent = wrapper.findComponent({ name: 'MapComponent' })
    expect(mapComponent.exists()).toBe(true)
    expect(mapComponent.props('name')).toBe(undefined)
  })

  it('contains MapComponent when fully mounted', async () => {
    // Mock useRoute to return a route with no name parameter
    vi.mocked(useRoute).mockReturnValue({
      params: {
        name: '',
      },
      path: '/',
      name: 'home',
      fullPath: '/',
      query: {},
      hash: '',
      matched: [],
      meta: {},
      redirectedFrom: undefined,
    } as RouteLocationNormalizedGeneric)

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

  it('passes route params to MapComponent', () => {
    // Mock useRoute to return a route with a specific name parameter
    vi.mocked(useRoute).mockReturnValue({
      params: {
        name: 'testuser',
      },
      path: '/testuser',
      name: 'user',
      fullPath: '/testuser',
      query: {},
      hash: '',
      matched: [],
      meta: {},
      redirectedFrom: undefined,
    } as RouteLocationNormalizedGeneric)

    const wrapper = shallowMount(HomeView)

    // Check if MapComponent receives the name prop
    const mapComponent = wrapper.findComponent({ name: 'MapComponent' })
    expect(mapComponent.exists()).toBe(true)
    expect(mapComponent.props('name')).toBe('testuser')
  })
})
