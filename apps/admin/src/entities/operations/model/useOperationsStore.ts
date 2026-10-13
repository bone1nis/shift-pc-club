import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Booking, Catalog, GamingSession } from '@shift/contracts'
import { api, errorMessage } from '@fsd/shared/api'

/**
 * Общее состояние смены: каталог, брони и сессии, а также единая обёртка для действий
 * администратора (защита от повторного запуска, сообщения, обновление данных).
 */
const NOTICE_MS = 6000

export const useOperationsStore = defineStore('operations', () => {
  const catalog = ref<Catalog | null>(null)
  const bookings = ref<Booking[]>([])
  const sessions = ref<GamingSession[]>([])
  const loading = ref(false)
  const pending = ref(false)
  const error = ref('')
  const notice = ref('')
  /** Увеличивается после каждого обновления: страницы перечитывают свои данные. */
  const tick = ref(0)

  const activeSessions = computed(() => sessions.value.filter((s) => s.status !== 'completed'))
  const confirmedBookings = computed(() => bookings.value.filter((b) => b.status === 'confirmed'))
  const freeWorkstations = computed(() =>
    (catalog.value?.workstations ?? []).filter(
      (w) =>
        w.status === 'available' && !activeSessions.value.some((s) => s.workstation_id === w.id),
    ),
  )

  async function load() {
    loading.value = true
    error.value = ''
    try {
      const [nextCatalog, nextBookings, nextSessions] = await Promise.all([
        api<Catalog>('/api/club/catalog'),
        api<Booking[]>('/api/booking/admin/bookings'),
        api<GamingSession[]>('/api/booking/admin/sessions'),
      ])
      catalog.value = nextCatalog
      bookings.value = nextBookings
      sessions.value = nextSessions
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      loading.value = false
    }
  }
  async function refresh() {
    await load()
    tick.value++
  }
  /** Выполняет действие администратора; повторный запуск во время выполнения игнорируется. */
  async function run(action: () => Promise<unknown>, success: string) {
    if (pending.value) return false
    pending.value = true
    error.value = ''
    notice.value = ''
    try {
      await action()
      notice.value = success
      // Успех пропадает сам; ошибка остаётся, пока её не заменит следующее действие.
      setTimeout(() => {
        if (notice.value === success) notice.value = ''
      }, NOTICE_MS)
      await refresh()
      return true
    } catch (cause) {
      error.value = errorMessage(cause)
      return false
    } finally {
      pending.value = false
    }
  }
  function fail(cause: unknown) {
    error.value = errorMessage(cause)
  }

  return {
    catalog,
    bookings,
    sessions,
    loading,
    pending,
    error,
    notice,
    tick,
    activeSessions,
    confirmedBookings,
    freeWorkstations,
    load,
    refresh,
    run,
    fail,
  }
})
