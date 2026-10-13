import { computed, onMounted, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useIntervalFn } from '@vueuse/core'
import { navigateTo } from '#imports'
import {
  authSessionSchema,
  bookingSchema,
  gamingSessionSchema,
  notificationSchema,
} from '@shift/contracts'
import { z } from 'zod'
import { useUserStore } from '@fsd/entities/user'
import { apiParsed, errorMessage } from '@fsd/shared/api'

const POLL_MS = 30_000

/**
 * Данные кабинета игрока: брони, игровые сессии и сеансы входа.
 * Загрузкой, кэшем, обновлением раз в 30 секунд и при возврате на вкладку занимается TanStack Query.
 */
export function useAccount() {
  const user = useUserStore()
  const notice = ref('')
  const now = ref(Date.now())
  // Запросы начинаются только после того, как мы убедились, что игрок вошёл.
  const signedIn = ref(false)
  const checked = ref(false)

  const query = useQuery({
    queryKey: ['account'],
    enabled: signedIn,
    refetchInterval: POLL_MS,
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
  const authSessions = computed(() => query.data.value?.authSessions ?? [])
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

  // Оставшееся время на карточках пересчитывается каждые 30 секунд вместе с данными.
  useIntervalFn(() => {
    now.value = Date.now()
  }, POLL_MS)

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
