import { useAsyncData, useRuntimeConfig } from '#imports'
import type { ApiResponse, ClubProfile } from '@shift/contracts'

/** Контакты, адрес и часы работы клуба (Club API); общий ключ — один запрос на страницу. */
export function useClubProfile() {
  const config = useRuntimeConfig()
  return useAsyncData('club-profile', async () => {
    const baseURL = import.meta.server
      ? config.apiInternalOrigin
      : config.public.apiBase || undefined
    return (await $fetch<ApiResponse<ClubProfile>>('/api/club/profile', { baseURL })).data
  })
}
