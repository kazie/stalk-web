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
