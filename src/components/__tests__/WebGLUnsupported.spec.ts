import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WebGLUnsupported from '../WebGLUnsupported.vue'

describe('WebGLUnsupported', () => {
  it('links to the classic version when a fallback url is given', () => {
    const wrapper = mount(WebGLUnsupported, { props: { fallbackUrl: 'https://old.example.com' } })

    expect(wrapper.text()).toContain("doesn't support WebGL")
    expect(wrapper.find('a.fallback-link').attributes('href')).toBe('https://old.example.com')
  })

  it('only shows the message when no fallback url is configured', () => {
    const wrapper = mount(WebGLUnsupported)

    expect(wrapper.text()).toContain("doesn't support WebGL")
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
