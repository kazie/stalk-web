import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  apiKey,
  checkStalkingData,
  deleteStalkingData,
  isCheckingStalkingData,
  isDeleting,
  isStalking,
  sendRate,
  setSendRate,
  stalkingDataExists,
  stalkingError,
  stalkingName,
  startStalking,
  stopStalking,
  type SendRate,
} from '@/services/stalkingService'

export const useStalkingPanel = () => {
  const expanded = ref(false)
  let nameCheckTimer: ReturnType<typeof setTimeout> | null = null

  const canDelete = computed(
    () =>
      !isStalking.value &&
      !isDeleting.value &&
      !isCheckingStalkingData.value &&
      stalkingDataExists.value &&
      !!apiKey.value.trim(),
  )

  const scheduleNameCheck = (name: string): void => {
    stalkingDataExists.value = false
    void checkStalkingData('')
    if (nameCheckTimer !== null) clearTimeout(nameCheckTimer)
    if (!name.trim()) return

    nameCheckTimer = setTimeout(() => {
      nameCheckTimer = null
      void checkStalkingData(name)
    }, 300)
  }

  watch(stalkingName, scheduleNameCheck)

  onMounted(() => {
    void checkStalkingData()
  })

  onUnmounted(() => {
    if (nameCheckTimer !== null) clearTimeout(nameCheckTimer)
  })

  return {
    apiKey,
    canDelete,
    expanded,
    isCheckingStalkingData,
    isDeleting,
    isStalking,
    sendRate,
    stalkingError,
    stalkingName,
    togglePanel: () => {
      expanded.value = !expanded.value
    },
    toggleStalking: () => {
      if (isStalking.value) stopStalking()
      else startStalking()
    },
    onSendRateChange: () => setSendRate(sendRate.value as SendRate),
    onDelete: deleteStalkingData,
  }
}
