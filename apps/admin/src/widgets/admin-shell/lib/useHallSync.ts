import { onScopeDispose, watch } from 'vue'
import { hallChannel } from '@shift/contracts'
import { useRealtime, useRealtimeChannel } from '@shift/ui'

export const HALL_DEBOUNCE_MS = 300
export const POLL_LIVE_MS = 120_000
export const POLL_FALLBACK_MS = 30_000

/**
 * Обновляет данные зала по сигналу hall.changed (всплеск сигналов сводится к одному обновлению),
 * а периодический опрос оставляет запасным: реже, пока соединение живо.
 */
export function useHallSync(ops: { pending: boolean; refresh: () => unknown }) {
  const realtime = useRealtime()
  // ops — store Pinia: pending читается при каждом обращении.
  const isPending = () => ops.pending
  let debounce: ReturnType<typeof setTimeout> | undefined
  let timer: ReturnType<typeof setInterval> | undefined

  useRealtimeChannel(hallChannel, '.hall.changed', () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      debounce = undefined
      if (!isPending()) void ops.refresh()
    }, HALL_DEBOUNCE_MS)
  })

  watch(
    () => realtime.isLive.value,
    (live) => {
      if (timer) clearInterval(timer)
      timer = setInterval(
        () => {
          if (!isPending()) void ops.refresh()
        },
        live ? POLL_LIVE_MS : POLL_FALLBACK_MS,
      )
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    if (timer) clearInterval(timer)
    if (debounce) clearTimeout(debounce)
  })
}
