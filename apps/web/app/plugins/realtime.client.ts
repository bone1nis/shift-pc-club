import { computed } from 'vue'
import { configureRealtime, useRealtimeSession } from '@shift/ui'
import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import { useUserStore } from '@fsd/entities/user'

/** Realtime (Reverb): соединение открывается только после входа и закрывается при выходе. */
export default defineNuxtPlugin((nuxtApp) => {
  configureRealtime({ key: useRuntimeConfig().public.reverbAppKey })
  const user = useUserStore(nuxtApp.$pinia)
  useRealtimeSession(computed(() => user.user?.id))
})
