import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'

export const useSettingsChat = defineStore('settings-chat', () => {
  const combineSystemMessages = useLocalStorageManualReset<boolean>('settings/chat/combine-system-messages', false)

  function resetState() {
    combineSystemMessages.reset()
  }

  return {
    combineSystemMessages,
    resetState,
  }
})
