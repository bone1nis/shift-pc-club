import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

const isLive = ref(false)
const handlers: Record<string, () => void> = {}
const invalidate = vi.fn()
const queryOptions: { refetchInterval?: { value: number } }[] = []
const userRef = ref<{ id: number } | null>({ id: 7 })
const bookingsData = ref<{ status: string }[]>([])
const sessionsData = ref<{ status: string }[]>([])

vi.mock('@shift/ui', () => ({
  useRealtime: () => ({
    isLive,
    subscribe: (channel: string, event: string, cb: () => void) => {
      handlers[`${channel}|${event}`] = cb
      return () => delete handlers[`${channel}|${event}`]
    },
  }),
}))
vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({ invalidateQueries: invalidate, setQueryData: vi.fn() }),
  useQuery: (o: (typeof queryOptions)[number]) => {
    queryOptions.push(o)
    return {
      data: ref({
        get bookings() {
          return bookingsData.value
        },
        get sessions() {
          return sessionsData.value
        },
        authSessions: [],
        notifications: [],
      }),
      isPending: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    }
  },
}))
vi.mock('#imports', () => ({ navigateTo: vi.fn() }))
vi.mock('@fsd/entities/user', () => ({
  useUserStore: () => ({
    get user() {
      return userRef.value
    },
    load: vi.fn(),
  }),
}))
vi.mock('@fsd/shared/api', () => ({ apiParsed: vi.fn(), errorMessage: String }))

const { useAccount, POLL_MS, POLL_LIVE_MS, ACCOUNT_EVENT } =
  await import('../../apps/web/src/pages/account/model/useAccount')

function mount() {
  const scope = effectScope()
  const account = scope.run(() => useAccount())!
  return { scope, account }
}

describe('кабинет и realtime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T10:00:00Z'))
    isLive.value = false
    queryOptions.length = 0
    bookingsData.value = []
    sessionsData.value = []
    for (const k of Object.keys(handlers)) delete handlers[k]
  })
  afterEach(() => vi.useRealTimers())

  it('сигнал account.changed инвалидирует запрос кабинета', () => {
    const { scope } = mount()
    expect(ACCOUNT_EVENT).toBe('.account.changed')
    handlers['private-user.7|.account.changed']()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['account'] })
    scope.stop()
    expect(Object.keys(handlers)).toHaveLength(0)
  })

  it('интервал опроса зависит от isLive', async () => {
    const { scope } = mount()
    const interval = queryOptions[0].refetchInterval!
    expect(interval.value).toBe(POLL_MS)
    isLive.value = true
    await nextTick()
    expect(interval.value).toBe(POLL_LIVE_MS)
    scope.stop()
  })

  it('отсчёт идёт раз в секунду только при активной сессии', async () => {
    const { scope, account } = mount()
    const start = account.now.value
    vi.advanceTimersByTime(3000)
    expect(account.now.value).toBe(start)

    sessionsData.value = [{ status: 'active' }]
    await nextTick()
    vi.advanceTimersByTime(3000)
    expect(account.now.value).toBeGreaterThanOrEqual(start + 3000)

    sessionsData.value = []
    await nextTick()
    const frozen = account.now.value
    vi.advanceTimersByTime(5000)
    expect(account.now.value).toBe(frozen)
    scope.stop()
  })
})
