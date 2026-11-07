import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StalkingPanel from '../StalkingPanel.vue'

const mocked = vi.hoisted(() => ({
  apiKey: { value: 'token', __v_isRef: true },
  checkStalkingData: vi.fn(),
  stalkingName: { value: 'Alice', __v_isRef: true },
  sendRate: { value: 'live', __v_isRef: true },
  isStalking: { value: false, __v_isRef: true },
  isDeleting: { value: false, __v_isRef: true },
  isCheckingStalkingData: { value: false, __v_isRef: true },
  stalkingDataExists: { value: true, __v_isRef: true },
  stalkingError: { value: null, __v_isRef: true },
  startStalking: vi.fn(),
  stopStalking: vi.fn(),
  setSendRate: vi.fn(),
  deleteStalkingData: vi.fn(),
}))

vi.mock('@/services/stalkingService', () => mocked)

describe('StalkingPanel', () => {
  beforeEach(() => {
    mocked.apiKey.value = 'token'
    mocked.stalkingName.value = 'Alice'
    mocked.sendRate.value = 'live'
    mocked.isStalking.value = false
    mocked.isDeleting.value = false
    mocked.isCheckingStalkingData.value = false
    mocked.stalkingDataExists.value = true
    mocked.stalkingError.value = null
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts collapsed and exposes the rate selector after expanding', async () => {
    const wrapper = mount(StalkingPanel)

    expect(wrapper.find('.stalking-panel-content').exists()).toBe(false)
    expect(wrapper.find('.stalking-panel-toggle').text()).toBe('🕵️ Stalk Me')
    await wrapper.find('.stalking-panel-toggle').trigger('click')

    expect(wrapper.find('.stalking-panel-content').exists()).toBe(true)
    expect(wrapper.find('#stalking-send-rate').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('#stalking-send-rate option[value="1000"]').exists()).toBe(true)
  })

  it('shows that the location is being sent while collapsed', async () => {
    mocked.isStalking.value = true
    const wrapper = mount(StalkingPanel)

    const toggle = wrapper.find('.stalking-panel-toggle')
    expect(toggle.find('.sending-dot').exists()).toBe(true)
    expect(toggle.text()).toContain('Sending')
  })

  it('closes from the backdrop and with Escape, handing focus back to the toggle', async () => {
    const wrapper = mount(StalkingPanel, { attachTo: document.body })
    const toggle = wrapper.find('.stalking-panel-toggle')
    await toggle.trigger('click')

    await wrapper.find('.stalking-panel-backdrop').trigger('click')
    expect(wrapper.find('.stalking-panel-content').exists()).toBe(false)
    expect(document.activeElement).toBe(toggle.element)

    await toggle.trigger('click')
    ;(document.querySelector('#stalking-send-rate') as HTMLElement).focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.stalking-panel-content').exists()).toBe(false)
    expect(document.activeElement).toBe(toggle.element)
  })

  it('moves focus into the panel when it opens', async () => {
    const wrapper = mount(StalkingPanel, { attachTo: document.body })
    const toggle = wrapper.find('.stalking-panel-toggle')
    ;(document.activeElement as HTMLElement | null)?.blur()

    await toggle.trigger('click')
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(toggle.element)
  })

  it('keeps Tab inside the open sheet', async () => {
    const wrapper = mount(StalkingPanel, { attachTo: document.body })
    await wrapper.find('.stalking-panel-toggle').trigger('click')
    const focusable = [
      ...(wrapper.element as HTMLElement).querySelectorAll<HTMLElement>(
        'button:not(:disabled), select, input',
      ),
    ]
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!

    last.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    expect(document.activeElement).toBe(first)

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(last)
  })

  it('leaves the panel open on Escape that ends an IME composition', async () => {
    const wrapper = mount(StalkingPanel)
    await wrapper.find('.stalking-panel-toggle').trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.stalking-panel-content').exists()).toBe(true)
  })

  it('starts stalking through the main action', async () => {
    const wrapper = mount(StalkingPanel)
    await wrapper.find('.stalking-panel-toggle').trigger('click')

    await wrapper.find('.start-stalking-button').trigger('click')
    expect(mocked.startStalking).toHaveBeenCalledTimes(1)
  })

  it('enables delete only while stopped and calls the delete action', async () => {
    const wrapper = mount(StalkingPanel)
    await wrapper.find('.stalking-panel-toggle').trigger('click')

    const deleteButton = wrapper.find('.delete-stalking-button')
    expect(deleteButton.attributes('disabled')).toBeUndefined()
    await deleteButton.trigger('click')
    expect(mocked.deleteStalkingData).toHaveBeenCalledTimes(1)
  })
})
