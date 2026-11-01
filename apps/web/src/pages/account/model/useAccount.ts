import { computed, onMounted, ref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useIntervalFn } from '@vueuse/core'
import { navigateTo } from '#imports'
import { useRealtime } from '@shift/ui'
import {
  authSessionSchema,
  bookingSchema,
  gamingSessionSchema,
  notificationSchema,
  userChannel,
} from '@shift/contracts'
import { z } from 'zod'
import type { AuthSession } from '@fsd/features/manage-auth-sessions'
import { useUserStore } from '@fsd/entities/user'
import { apiParsed, errorMessage } from '@fsd/shared/api'

/** Опрос без realtime — каждые 30 с; при живом соединении — редкий фолбэк. */
export const POLL_MS = 30_000
export const POLL_LIVE_MS = 120_000
/** Событие приходит с точкой: имя задано сервером без пространства имён. */
export const ACCOUNT_EVENT = '.account.changed'

/**
 * Данные кабинета игрока: брони, игровые сессии и сеансы входа.
 * Загрузкой, кэшем, сигналом realtime, редким опросом и обновлением при возврате на вкладку занимается TanStack Query.
 */
export function useAccount() {
  const user = useUserStore()
  const queryClient = useQueryClient()
  const notice = ref('')
  const now = ref(Date.now())
  // Запросы начинаются только после того, как мы убедились, что игрок вошёл.
  const signedIn = ref(false)
  const checked = ref(false)

  const realtime = useRealtime()
  const query = useQuery({
    queryKey: ['account'],
    enabled: signedIn,
    refetchInterval: computed(() => (realtime.isLive.value ? POLL_LIVE_MS : POLL_MS)),
    queryFn: async () => {
      const [bookings, sessions, authSessions, notifications] = await Promise.all([
        apiParsed(z.array(bookingSchema), '/api/booking/bookings'),
        apiParsed(z.array(gamingSessionSchema), '/api/booking/sessions'),
        apiParsed(z.array(authSessionSchema), '/api/auth/sessions'),
        apiParsed(z.array(notificationSchema), '/api/booking/notifications'),
      ])
      return { bookings, sessions, authSessions, notifications }
    },
  })

  const bookings = computed(() => query.data.value?.bookings ?? [])
  const sessions = computed(() => query.data.value?.sessions ?? [])
  // Список сеансов записываемый: после отзыва компонент сразу убирает строку из кэша запроса, не дожидаясь опроса.
  const authSessions = computed<AuthSession[]>({
    get: () => query.data.value?.authSessions ?? [],
    set: (value) => {
      queryClient.setQueryData(['account'], (old: typeof query.data.value) =>
        old ? { ...old, authSessions: value } : old,
      )
    },
  })
  const notifications = computed(() => query.data.value?.notifications ?? [])
  const loading = computed(() => !checked.value || (query.isPending.value && signedIn.value))
  // Ошибку можно задать снаружи (из карточек бронирований и профиля) — поэтому она записываемая.
  const actionError = ref('')
  const error = computed({
    get: () => actionError.value || (query.error.value ? errorMessage(query.error.value) : ''),
    set: (value: string) => {
      actionError.value = value
    },
  })
  const active = computed(() => sessions.value.filter((s) => s.status !== 'completed'))
  const history = computed(() => sessions.value.filter((s) => s.status === 'completed'))

  async function load() {
    actionError.value = ''
    await query.refetch()
  }

  // Realtime присылает только сигнал, данные берём через REST. Опрос остаётся фолбэком.
  watch(
    () => user.user?.id,
    (id, _old, onCleanup) => {
      if (!id) return
      const off = realtime.subscribe(userChannel(id), ACCOUNT_EVENT, () => {
        void queryClient.invalidateQueries({ queryKey: ['account'] })
      })
      onCleanup(off)
    },
    { immediate: true },
  )

  // Оставшееся время считается на клиенте от серверной метки ends_at, без сети.
  // Тикает раз в секунду, только пока есть активная сессия или подтверждённая бронь.
  const ticking = computed(
    () => active.value.length > 0 || bookings.value.some((b) => b.status === 'confirmed'),
  )
  const clock = useIntervalFn(
    () => {
      now.value = Date.now()
    },
    1000,
    { immediate: false },
  )
  watch(
    ticking,
    (on) => {
      if (on) {
        now.value = Date.now()
        clock.resume()
      } else clock.pause()
    },
    { immediate: true },
  )

  onMounted(async () => {
    await user.load()
    if (!user.user) {
      checked.value = true
      await navigateTo('/auth?next=/account')
      return
    }
    signedIn.value = true
    checked.value = true
  })

  return {
    user,
    bookings,
    sessions,
    authSessions,
    notifications,
    loading,
    error,
    notice,
    now,
    active,
    history,
    load,
  }
}
