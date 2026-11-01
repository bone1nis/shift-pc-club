import { describe, expect, it, vi } from 'vitest'
import { createRealtime } from '../../packages/ui/src/lib/realtime'
import type { EchoLike } from '../../packages/ui/src/lib/realtime'

function fakeEcho() {
  const calls: string[] = []
  const channel = {
    listen: vi.fn(),
    stopListening: vi.fn(),
    here: vi.fn(() => calls.push('here')),
    joining: vi.fn(() => calls.push('joining')),
    leaving: vi.fn(() => calls.push('leaving')),
    listenForWhisper: vi.fn(() => calls.push('listenForWhisper')),
    whisper: vi.fn(),
  }
  const echo = {
    disconnect: vi.fn(),
    leave: vi.fn(),
    private: () => channel,
    join: vi.fn(() => channel),
    channel: () => channel,
  }
  return { echo, channel, calls }
}

describe('presence в клиенте realtime', () => {
  it('подписывается, шлёт whisper и уходит с канала', async () => {
    const made: ReturnType<typeof fakeEcho>[] = []
    const client = createRealtime({
      key: 'k',
      createEcho: async () => {
        const f = fakeEcho()
        made.push(f)
        return f.echo as unknown as EchoLike
      },
    })
    const here = vi.fn()
    const handle = client.presence('presence-booking.5.chat', {
      here,
      whispers: { typing: vi.fn() },
    })
    client.connect()
    for (let i = 0; i < 5; i++) await Promise.resolve()
    expect(made[0]!.echo.join).toHaveBeenCalledWith('booking.5.chat')
    expect(made[0]!.channel.here).toHaveBeenCalledWith(here)
    expect(made[0]!.channel.listenForWhisper).toHaveBeenCalledWith('typing', expect.any(Function))
    handle.whisper('typing', { userId: 1 })
    expect(made[0]!.channel.whisper).toHaveBeenCalledWith('typing', { userId: 1 })
    handle.leave()
    expect(made[0]!.echo.leave).toHaveBeenCalledWith('booking.5.chat')
    handle.whisper('typing', {})
    expect(made[0]!.channel.whisper).toHaveBeenCalledTimes(1)
  })

  it('whisper без соединения ничего не делает', () => {
    const client = createRealtime({ key: 'k' })
    const handle = client.presence('presence-booking.5.chat', {})
    expect(() => handle.whisper('typing', {})).not.toThrow()
    handle.leave()
  })
})
