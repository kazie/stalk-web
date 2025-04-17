import { describe, it, expect, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { h } from 'vue'
import App from '../App.vue'

// Mock the HomeView component to isolate App testing
vi.mock('../views/HomeView.vue', () => ({
  default: {
    name: 'HomeView',
    render() {
      return h('div', { class: 'mock-home-view' }, 'Mocked Home View')
    }
  }
}))

describe('App', () => {
  it('renders properly with shallow mount', () => {
    const wrapper = shallowMount(App)
    
    // With shallowMount, HomeView should be stubbed
    expect(wrapper.findComponent({ name: 'HomeView' }).exists()).toBe(true)
  })
  
  it('contains HomeView when fully mounted', () => {
    // For this test, we'll use a different approach since we mocked the component
    // We'll check if the component tries to render HomeView
    
    const wrapper = mount(App, {
      global: {
        stubs: {
          HomeView: true
        }
      }
    })
    
    // Check if HomeView is included in the template
    expect(wrapper.html()).toContain('home-view-stub')
  })
})