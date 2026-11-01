import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

const isLive = ref(false)
let signal: (() => void) | undefined
const subscribed: { channel: string; event: string }[] = []
vi.mock('@shift/ui', () => ({
  useRealtime: () => ({ isLive }),
  useRealtimeChannel: (channel: string, event: string, cb: () => void) => {
    subscribed.push({ channel, event })
    signal = cb
  },
}))

import {
  HALL_DEBOUNCE_MS,
  POLL_FALLBACK_MS,
  POLL_LIVE_MS,
  useHallSync,
} from '../../apps/admin/src/widgets/admin-shell/lib/useHallSync'
import { canUseAdminPanel } from '../../apps/admin/src/shared/lib/role'

describe('useHallSync', () => {
  const ops = { pending: false, refresh: vi.fn() }
  let scope: ReturnType<typeof effectScope>
  beforeEach(() => {
    vi.useFakeTimers()
    ops.pending = false
    isLive.value = false
    scope = effectScope()
    scope.run(() => useHallSync(ops))
  })
  afterEach(() => {
    scope.stop()
    vi.useRealTimers()
  })

  it('subscribes to the hall channel', () => {
    expect(subscribed.at(-1)).toEqual({ channel: 'private-hall', event: '.hall.changed' })
  })

  it('coalesces a burst of signals into one refresh', () => {
    for (let i = 0; i < 5; i++) signal!()
    vi.advanceTimersByTime(HALL_DEBOUNCE_MS - 1)
    expect(ops.refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(ops.refresh).toHaveBeenCalledTimes(1)
  })

  it('skips refresh while an action is pending', () => {
    ops.pending = true
    signal!()
    vi.advanceTimersByTime(HALL_DEBOUNCE_MS)
    expect(ops.refresh).not.toHaveBeenCalled()
  })

  it('polls every 30s without realtime and every 120s with it', async () => {
    vi.advanceTimersByTime(POLL_FALLBACK_MS)
    expect(ops.refresh).toHaveBeenCalledTimes(1)
    isLive.value = true
    await Promise.resolve()
    vi.advanceTimersByTime(POLL_FALLBACK_MS * 2)
    expect(ops.refresh).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(POLL_LIVE_MS - POLL_FALLBACK_MS * 2)
    expect(ops.refresh).toHaveBeenCalledTimes(2)
  })
})

describe('canUseAdminPanel', () => {
  it('lets admin and owner in, not players or guests', () => {
    expect(canUseAdminPanel('admin')).toBe(true)
    expect(canUseAdminPanel('owner')).toBe(true)
    expect(canUseAdminPanel('player')).toBe(false)
    expect(canUseAdminPanel(undefined)).toBe(false)
  })
})
