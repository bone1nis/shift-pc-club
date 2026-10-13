import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { defineNuxtPlugin } from '#imports'

/** Клиент запросов TanStack Query: кэш, повторные запросы и фоновое обновление данных кабинета. */
export default defineNuxtPlugin((nuxtApp) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // Данные считаются свежими 10 секунд: переходы между страницами не дёргают сервер лишний раз.
        staleTime: 10_000,
        // Ошибки показываем сразу: сервис либо отвечает, либо нет; 401 и 409 повторять бессмысленно.
        retry: false,
        refetchOnWindowFocus: true,
      },
    },
  })
  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient: client })
})
