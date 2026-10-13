import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBookingSelection } from '../../apps/web/src/features/create-booking/model/selection'
import { track } from '../../apps/web/src/shared/analytics'

vi.mock('../../apps/web/src/shared/analytics', () => ({ track: vi.fn() }))

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const START = '2026-10-15T18:30'
const available = [
  { workstation_id: 1, available: true },
  { workstation_id: 2, available: true },
]

type Call = { url: string; method: string; headers: Headers; body?: string }
function stubFetch(handler: (call: Call) => Promise<Response> | Response) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call = {
        url,
        method: init.method ?? 'GET',
        headers: new Headers(init.headers),
        body: init.body as string | undefined,
      }
      calls.push(call)
      return handler(call)
    }),
  )
  document.cookie = 'XSRF-TOKEN=test; path=/'
  return calls
}

async function readyChoice() {
  const choice = useBookingSelection()
  await choice.refresh(START, 2)
  choice.toggle(1)
  return choice
}

describe('booking submit', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  it('ignores a second click while the first request is pending', async () => {
    let finish!: (response: Response) => void
    const calls = stubFetch((call) =>
      call.method === 'POST'
        ? new Promise<Response>((done) => {
            finish = done
          })
        : json(200, { data: available }),
    )
    const choice = await readyChoice()
    const first = choice.submit(START, 2)
    await vi.waitFor(() => expect(choice.pending.value).toBe(true))
    expect(await choice.submit(START, 2)).toBeNull()
    finish(json(201, { data: { id: 5 } }))
    expect(await first).toEqual({ id: 5 })
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
    expect(choice.pending.value).toBe(false)
  })

  it('reuses the Idempotency-Key for a retry of the same selection', async () => {
    let attempt = 0
    const calls = stubFetch((call) => {
      if (call.method !== 'POST') return json(200, { data: available })
      return ++attempt === 1
        ? json(503, { message: 'Сервис недоступен' })
        : json(201, { data: { id: 8 } })
    })
    const choice = await readyChoice()
    expect(await choice.submit(START, 2)).toBeNull()
    expect(choice.error.value).toBe('Сервис недоступен')
    expect(await choice.submit(START, 2)).toEqual({ id: 8 })
    const posts = calls.filter((c) => c.method === 'POST')
    expect(posts).toHaveLength(2)
    expect(posts[0]!.headers.get('Idempotency-Key')).toBe(posts[1]!.headers.get('Idempotency-Key'))
  })

  it('changes the Idempotency-Key when the selection changes', async () => {
    const calls = stubFetch((call) =>
      call.method === 'POST' ? json(503, { message: 'x' }) : json(200, { data: available }),
    )
    const choice = await readyChoice()
    await choice.submit(START, 2)
    choice.toggle(2)
    await choice.submit(START, 2)
    const keys = calls
      .filter((c) => c.method === 'POST')
      .map((c) => c.headers.get('Idempotency-Key'))
    expect(keys[0]).not.toBe(keys[1])
  })

  it('refreshes availability and explains a 409 conflict', async () => {
    const calls = stubFetch((call) =>
      call.method === 'POST'
        ? json(409, { message: 'Место занято' })
        : json(200, { data: [{ workstation_id: 1, available: false }, available[1]] }),
    )
    const choice = await readyChoice()
    expect(await choice.submit(START, 2)).toBeNull()
    expect(choice.error.value).toContain('Схема обновлена')
    expect(choice.selected.value).toEqual([])
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2)
    expect(choice.availability.value[0]).toMatchObject({ workstation_id: 1, available: false })
  })

  it('keeps the selection and shows the server message on a 422', async () => {
    stubFetch((call) =>
      call.method === 'POST'
        ? json(422, {
            message: 'Выберите время в ближайшие 30 дн.',
            errors: { starts_at: ['bad'] },
          })
        : json(200, { data: available }),
    )
    const choice = await readyChoice()
    expect(await choice.submit(START, 2)).toBeNull()
    expect(choice.error.value).toBe('Выберите время в ближайшие 30 дн.')
    expect(choice.selected.value).toEqual([1])
  })

  it('reports the start of booking once, on the first selected seat', async () => {
    stubFetch(() => json(200, { data: available }))
    const choice = useBookingSelection()
    await choice.refresh(START, 2)
    choice.toggle(1)
    choice.toggle(2)
    choice.toggle(1)
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('booking_started', '/booking')
  })

  it('does not submit without selected seats', async () => {
    const calls = stubFetch(() => json(200, { data: available }))
    const choice = useBookingSelection()
    await choice.refresh(START, 2)
    expect(await choice.submit(START, 2)).toBeNull()
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('drops a stale availability response after a newer refresh', async () => {
    const pendingResponses: Array<(response: Response) => void> = []
    stubFetch(
      () =>
        new Promise<Response>((done) => {
          pendingResponses.push(done)
        }),
    )
    const choice = useBookingSelection()
    const older = choice.refresh('2026-10-15T18:30', 1)
    const newer = choice.refresh('2026-10-15T20:00', 1)
    pendingResponses[1]!(json(200, { data: [{ workstation_id: 2, available: true }] }))
    await newer
    pendingResponses[0]!(json(200, { data: [{ workstation_id: 1, available: true }] }))
    await older
    expect(choice.availability.value).toEqual([{ workstation_id: 2, available: true }])
  })
})
