import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import {
  configureRealtime,
  createRealtime,
  useRealtimeChannel,
  useRealtimeSession,
} from '../../packages/ui/src/lib/realtime'
import type { EchoLike } from '../../packages/ui/src/lib/realtime'

type StateCb = (p?: { current?: string }) => void
function fakeEcho() {
  const handlers: Record<string, StateCb> = {}
  const listeners: { channel: string; event: string; cb: unknown }[] = []
  const echo = {
    listeners,
    handlers,
    disconnect: vi.fn(),
    leave: vi.fn(),
    private: (n: string) => channel(`private-${n}`),
    join: (n: string) => channel(`presence-${n}`),
    channel: (n: string) => channel(n),
    connector: {
      pusher: {
        connection: {
          bind: (e: string, cb: StateCb) => {
            handlers[e] = cb
          },
        },
      },
    },
  }
  function channel(name: string) {
    return {
      listen(event: string, cb: unknown) {
        listeners.push({ channel: name, event, cb })
      },
      stopListening(event: string, cb: unknown) {
        const i = listeners.findIndex((l) => l.channel === name && l.event === event && l.cb === cb)
        if (i >= 0) listeners.splice(i, 1)
      },
    }
  }
  return echo
}

describe('realtime client', () => {
  let created: ReturnType<typeof fakeEcho>[]
  const factory = vi.fn(async () => {
    const e = fakeEcho()
    created.push(e)
    return e as unknown as EchoLike
  })
  const make = () =>
    createRealtime({ key: 'k', createEcho: factory, baseDelay: 100, maxDelay: 400 })
  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  }

  beforeEach(() => {
    created = []
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('does not connect without a key or before connect()', async () => {
    const client = createRealtime({ key: '', createEcho: factory })
    client.connect()
    await flush()
    expect(factory).not.toHaveBeenCalled()
    expect(client.status.value).toBe('disconnected')
  })

  it('connects only for a signed-in user and closes on sign-out', async () => {
    const client = configureRealtime({ key: 'k', createEcho: factory })
    const userId = ref<number | null>(null)
    const scope = effectScope()
    scope.run(() => useRealtimeSession(userId))
    await flush()
    expect(factory).not.toHaveBeenCalled()
    userId.value = 7
    await nextTick()
    await flush()
    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory.mock.calls[0]).toBeDefined()
    userId.value = null
    await nextTick()
    expect(created[0].disconnect).toHaveBeenCalled()
    expect(client.status.value).toBe('disconnected')
    scope.stop()
  })

  it('tracks status and isLive from connection state', async () => {
    const client = make()
    client.connect()
    expect(client.status.value).toBe('connecting')
    await flush()
    created[0].handlers.state_change({ current: 'connected' })
    expect(client.status.value).toBe('connected')
    expect(client.isLive.value).toBe(true)
    created[0].handlers.state_change({ current: 'unavailable' })
    expect(client.status.value).toBe('disconnected')
    expect(client.isLive.value).toBe(false)
  })

  it('resubscribes after reconnect with exponential delay', async () => {
    const client = make()
    const cb = vi.fn()
    client.subscribe('private-user.7', '.account.changed', cb)
    client.connect()
    await flush()
    expect(created[0].listeners).toHaveLength(1)
    expect(created[0].listeners[0].channel).toBe('private-user.7')
    created[0].handlers.state_change({ current: 'unavailable' })
    expect(created[0].disconnect).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(99)
    expect(created).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(created).toHaveLength(2)
    expect(created[1].listeners).toHaveLength(1)
    created[1].handlers.state_change({ current: 'unavailable' })
    await vi.advanceTimersByTimeAsync(199)
    expect(created).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(created).toHaveLength(3)
    created[2].handlers.state_change({ current: 'connected' })
    expect(client.status.value).toBe('connected')
  })

  it('unsubscribes and leaves the channel when the last listener is removed', async () => {
    const client = make()
    client.connect()
    await flush()
    const off = client.subscribe('private-hall', '.hall.changed', vi.fn())
    expect(created[0].listeners).toHaveLength(1)
    off()
    expect(created[0].listeners).toHaveLength(0)
    expect(created[0].leave).toHaveBeenCalledWith('hall')
  })

  it('auto-unsubscribes a channel hook when its scope stops', async () => {
    const client = configureRealtime({ key: 'k', createEcho: factory })
    client.connect()
    await flush()
    const scope = effectScope()
    scope.run(() => useRealtimeChannel('private-hall', '.hall.changed', vi.fn()))
    expect(created[0].listeners).toHaveLength(1)
    scope.stop()
    expect(created[0].listeners).toHaveLength(0)
  })

  it('stops reconnecting after disconnect()', async () => {
    const client = make()
    client.connect()
    await flush()
    created[0].handlers.state_change({ current: 'failed' })
    client.disconnect()
    await vi.advanceTimersByTimeAsync(1000)
    expect(created).toHaveLength(1)
  })
})
