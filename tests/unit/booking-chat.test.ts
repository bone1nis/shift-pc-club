import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

const isLive = ref(true)
const handlers: Record<string, (p: unknown) => void> = {}
const apiMock = vi.fn()
const uploadMock = vi.fn()
const whisperMock = vi.fn()
const leaveMock = vi.fn()
let presenceHandlers: {
  here?: (m: { id: number }[]) => void
  joining?: (m: { id: number }) => void
  leaving?: (m: { id: number }) => void
  whispers?: Record<string, (p: unknown) => void>
} = {}

vi.mock('@shift/ui', async (orig) => ({
  ...(await orig<object>()),
  useRealtime: () => ({
    isLive,
    presence: (_c: string, h: typeof presenceHandlers) => {
      presenceHandlers = h
      return { whisper: whisperMock, leave: leaveMock }
    },
  }),
  useRealtimeChannel: (channel: string, event: string, cb: (p: unknown) => void) => {
    handlers[`${channel}|${event}`] = cb
  },
}))
vi.mock('@fsd/entities/user', () => ({ useUserStore: () => ({ user: { id: 1 } }) }))
vi.mock('@fsd/shared/api', async (orig) => {
  const actual = await orig<typeof import('@fsd/shared/api')>()
  return {
    ...actual,
    api: (...a: unknown[]) => apiMock(...a),
    apiUpload: (...a: unknown[]) => uploadMock(...a),
    apiParsed: async (schema: { parse(v: unknown): unknown }, ...a: unknown[]) =>
      schema.parse(await apiMock(...a)),
  }
})

import { ApiFailure } from '@fsd/shared/api'
import {
  BookingChat,
  attachmentFailure,
  mergeMessages,
  validateAttachment,
} from '@fsd/features/booking-chat'

const KEY = 'private-booking.5.chat|.message.sent'
const msg = (id: number, senderId = 2, body = `m${id}`) => ({
  id,
  conversationId: 1,
  senderId,
  kind: 'text' as const,
  body,
  createdAt: '2026-10-16T10:00:00+00:00',
})
const convo = (over: Record<string, unknown> = {}) => ({
  id: 1,
  bookingId: 5,
  closed: false,
  muted: false,
  moderated: true,
  participants: [
    { userId: 1, role: 'owner', muted: false },
    { userId: 2, role: 'member', muted: false },
  ],
  ...over,
})

function setup(conversation = convo(), history = [msg(1), msg(2)]) {
  apiMock.mockImplementation(async (path: string, opts?: RequestInit) => {
    if (opts?.method === 'POST') return msg(99, 1, JSON.parse(String(opts.body)).body)
    if (path.includes('after_id')) return []
    if (path.includes('/messages')) return history
    return conversation
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(BookingChat, {
    props: { bookingId: 5, initialOpen: true },
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
  })
}
const texts = (w: ReturnType<typeof setup>) => w.findAll('.chat__body').map((n) => n.text())

beforeEach(() => {
  isLive.value = true
  for (const k of Object.keys(handlers)) delete handlers[k]
  apiMock.mockReset()
  uploadMock.mockReset()
  whisperMock.mockReset()
  presenceHandlers = {}
  Object.defineProperty(document, 'hasFocus', { value: () => true, configurable: true })
})
afterEach(() => vi.useRealTimers())

describe('чат брони', () => {
  it('mergeMessages убирает дубли и сортирует по id', () => {
    expect(mergeMessages([msg(2), msg(1)], [msg(2)]).map((m) => m.id)).toEqual([1, 2])
  })

  it('новое сообщение по событию появляется один раз, дубль игнорируется', async () => {
    const w = setup()
    await flushPromises()
    handlers[KEY]!(msg(3))
    handlers[KEY]!(msg(3))
    handlers[KEY]!({ nonsense: true })
    await flushPromises()
    expect(texts(w)).toEqual(['m1', 'm2', 'm3'])
  })

  it('после реконнекта догружает пропущенное', async () => {
    const w = setup()
    await flushPromises()
    isLive.value = false
    await nextTick()
    apiMock.mockImplementation(async (path: string) =>
      path.includes('after_id=2') ? [msg(3), msg(4)] : convo(),
    )
    isLive.value = true
    await flushPromises()
    expect(apiMock.mock.calls.some(([p]) => String(p).includes('after_id=2'))).toBe(true)
    expect(texts(w)).toEqual(['m1', 'm2', 'm3', 'm4'])
  })

  it('отправка показывает своё сообщение один раз, даже если событие пришло тоже', async () => {
    const w = setup()
    await flushPromises()
    await w.find('textarea').setValue('привет')
    await w.find('form').trigger('submit')
    handlers[KEY]!(msg(99, 1, 'привет'))
    await flushPromises()
    expect(texts(w).filter((t) => t === 'привет')).toHaveLength(1)
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('закрытый чат блокирует поле, история читается', async () => {
    const w = setup(convo({ closed: true }))
    await flushPromises()
    expect(w.find('textarea').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Чат закрыт')
    expect(texts(w)).toEqual(['m1', 'm2'])
  })

  it('заглушённому показывается пояснение и поле заблокировано', async () => {
    const w = setup(convo({ muted: true }))
    await flushPromises()
    expect(w.text()).toContain('Вас заглушили')
    expect(w.find('textarea').attributes('disabled')).toBeDefined()
  })

  it('ошибки отправки: 409 закрывает чат, 429 оставляет текст в поле', async () => {
    const w = setup()
    await flushPromises()
    apiMock.mockImplementation(async (_p: string, o?: RequestInit) => {
      if (o?.method === 'POST') throw new ApiFailure(429)
      return convo()
    })
    await w.find('textarea').setValue('раз')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Слишком часто')
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('раз')

    apiMock.mockImplementation(async (_p: string, o?: RequestInit) => {
      if (o?.method === 'POST') throw new ApiFailure(409)
      return convo()
    })
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Чат закрыт')
    expect(w.find('textarea').attributes('disabled')).toBeDefined()
  })

  it('403: «Чат создаётся…», повторы 1-2-4-8 с, затем сообщение с «Повторить»', async () => {
    vi.useFakeTimers()
    apiMock.mockRejectedValue(new ApiFailure(403))
    const w = mount(BookingChat, {
      props: { bookingId: 5, initialOpen: true },
      global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] },
    })
    const convoCalls = () =>
      apiMock.mock.calls.filter(([p]) => p === '/api/realtime/conversations/5').length
    await flushPromises()
    expect(w.text()).toContain('Чат создаётся')
    expect(convoCalls()).toBe(1)
    for (const [i, ms] of [1000, 2000, 4000, 8000].entries()) {
      await vi.advanceTimersByTimeAsync(ms - 1)
      expect(convoCalls()).toBe(i + 1)
      await vi.advanceTimersByTimeAsync(1)
      expect(convoCalls()).toBe(i + 2)
    }
    await vi.advanceTimersByTimeAsync(16000)
    await flushPromises()
    const total = convoCalls()
    expect(total).toBe(7)
    expect(w.text()).toContain('недоступен')
    expect(w.text()).not.toContain('Чат создаётся')
    await vi.advanceTimersByTimeAsync(30000)
    expect(convoCalls()).toBe(total)
    const retry = w.findAll('button').find((b) => b.text() === 'Повторить')!
    await retry.trigger('click')
    await flushPromises()
    expect(convoCalls()).toBe(total + 1)
    expect(w.text()).toContain('Чат создаётся')
  })

  it('403 исчезает сам, когда проекция участников готова', async () => {
    vi.useFakeTimers()
    let ready = false
    apiMock.mockImplementation(async (path: string) => {
      if (path.includes('/messages')) return [msg(1)]
      if (!ready) throw new ApiFailure(403)
      return convo()
    })
    const w = mount(BookingChat, {
      props: { bookingId: 5, initialOpen: true },
      global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] },
    })
    await flushPromises()
    expect(w.text()).toContain('Чат создаётся')
    ready = true
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(w.text()).not.toContain('Чат создаётся')
    expect(w.find('.chat__members').exists()).toBe(true)
  })

  it('пока панель закрыта и нет ?chat=, беседа не запрашивается', async () => {
    apiMock.mockResolvedValue(convo())
    const w = mount(BookingChat, {
      props: { bookingId: 5 },
      global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] },
    })
    await flushPromises()
    expect(apiMock).not.toHaveBeenCalled()
    await w.find('button').trigger('click')
    await flushPromises()
    expect(apiMock).toHaveBeenCalledWith('/api/realtime/conversations/5')
  })
  it('показывает, кто в сети', async () => {
    const w = setup()
    await flushPromises()
    presenceHandlers.here!([{ id: 1 }])
    presenceHandlers.joining!({ id: 2 })
    await nextTick()
    expect(w.find('.chat__members').text()).toContain('Игрок #2 (в сети)')
    presenceHandlers.leaving!({ id: 2 })
    await nextTick()
    expect(w.find('.chat__members').text()).not.toContain('Игрок #2 (в сети)')
  })

  it('«печатает…» гаснет через 5 с тишины и при сообщении от него, себе не показывается', async () => {
    const w = setup()
    await flushPromises()
    vi.useFakeTimers()
    const typing = presenceHandlers.whispers!.typing!
    typing({ userId: 1 })
    typing({ nonsense: true })
    await nextTick()
    expect(w.find('.chat__typing').text()).toBe('')
    typing({ userId: 2 })
    await nextTick()
    expect(w.find('.chat__typing').text()).toBe('Игрок #2 печатает…')
    vi.advanceTimersByTime(4900)
    typing({ userId: 2 })
    vi.advanceTimersByTime(4900)
    await nextTick()
    expect(w.find('.chat__typing').text()).toContain('печатает')
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(w.find('.chat__typing').text()).toBe('')
    typing({ userId: 2 })
    handlers[KEY]!(msg(3))
    await nextTick()
    expect(w.find('.chat__typing').text()).toBe('')
    expect(w.find('.chat__typing').attributes('aria-live')).toBe('off')
  })

  it('whisper «печатает» уходит не чаще раза в 2,5 с', async () => {
    const w = setup()
    await flushPromises()
    vi.useFakeTimers({ toFake: ['Date'] })
    const ta = w.find('textarea')
    await ta.setValue('п')
    await ta.setValue('пр')
    await ta.setValue('при')
    expect(whisperMock).toHaveBeenCalledTimes(1)
    expect(whisperMock).toHaveBeenCalledWith('typing', { userId: 1 })
    vi.advanceTimersByTime(2600)
    await ta.setValue('прив')
    expect(whisperMock).toHaveBeenCalledTimes(2)
  })

  it('«прочитано» уходит один раз на последнее чужое сообщение', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = setup(convo({ unreadCount: 2 }), [msg(1), msg(2), msg(3, 1)])
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(w.text()).not.toContain('Прочитано')
    await vi.advanceTimersByTimeAsync(700)
    const reads = () =>
      apiMock.mock.calls.filter(([p]) => String(p).endsWith('/read')) as [string, RequestInit][]
    expect(reads()).toHaveLength(1)
    expect(JSON.parse(String(reads()[0]![1].body))).toEqual({ upToMessageId: 2 })
    // своё сообщение и повтор того же id новых запросов не создают
    handlers[KEY]!(msg(4, 1))
    handlers[KEY]!(msg(2))
    await vi.advanceTimersByTimeAsync(1500)
    expect(reads()).toHaveLength(1)
    handlers[KEY]!(msg(5))
    await vi.advanceTimersByTimeAsync(700)
    expect(reads()).toHaveLength(2)
    expect(JSON.parse(String(reads()[1]![1].body))).toEqual({ upToMessageId: 5 })
  })

  it('без фокуса окна «прочитано» не отправляется', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    Object.defineProperty(document, 'hasFocus', { value: () => false, configurable: true })
    setup()
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)
    expect(apiMock.mock.calls.some(([p]) => String(p).endsWith('/read'))).toBe(false)
  })

  it('у своих сообщений появляется «Прочитано» по событию message.read', async () => {
    const w = setup(convo(), [msg(1), msg(2, 1)])
    await flushPromises()
    expect(w.text()).not.toContain('Прочитано')
    handlers['private-booking.5.chat|.message.read']!({ userId: 2, upToMessageId: 2 })
    await nextTick()
    expect(w.findAll('.chat__read')).toHaveLength(1)
  })

  it('счётчик непрочитанных на кнопке «Чат», пока панель закрыта', async () => {
    apiMock.mockImplementation(async (path: string) =>
      path.includes('/messages') ? [] : convo({ unreadCount: 2 }),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const w = mount(BookingChat, {
      props: { bookingId: 5 },
      global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
    })
    await flushPromises()
    expect(w.find('.booking-chat__badge').exists()).toBe(false) // лениво: пока не открывали
    await w.find('button').trigger('click')
    await flushPromises()
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.find('.booking-chat__badge').text()).toBe('2')
    handlers[KEY]!(msg(7))
    handlers[KEY]!(msg(8, 1))
    await flushPromises()
    expect(w.find('.booking-chat__badge').text()).toBe('3')
  })

  it('validateAttachment и ошибки вложений по-русски', () => {
    expect(validateAttachment({ type: 'image/png', size: 1000 })).toBe('')
    expect(validateAttachment({ type: 'application/pdf', size: 1000 })).toContain('PNG')
    expect(validateAttachment({ type: 'image/gif', size: 10 * 1024 * 1024 + 1 })).toContain('10 МБ')
    expect(attachmentFailure(new ApiFailure(413)).message).toContain('Лимит')
    expect(attachmentFailure(new ApiFailure(422)).message).toContain('до 10 МБ')
    expect(attachmentFailure(new ApiFailure(409))).toMatchObject({ closed: true })
    expect(attachmentFailure(new ApiFailure(403))).toMatchObject({ muted: true })
  })

  it('вложение: превью, отправка с подписью, ошибка 413 оставляет файл', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const w = setup()
    await flushPromises()
    const input = w.find('[data-testid="chat-file"]')
    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    expect(w.find('.chat__thumb').attributes('src')).toBe('blob:x')

    uploadMock.mockRejectedValueOnce(new ApiFailure(413))
    await w.find('textarea').setValue('смотри')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Лимит вложений')
    expect(w.find('.chat__thumb').exists()).toBe(true)

    uploadMock.mockResolvedValueOnce({
      ...msg(10, 1, 'смотри'),
      attachment: {
        id: 3,
        name: 'cat.png',
        mime: 'image/png',
        size: 1,
        url: '/api/realtime/attachments/3',
      },
    })
    await w.find('form').trigger('submit')
    await flushPromises()
    const form = uploadMock.mock.calls[1]![1] as FormData
    expect(form.get('body')).toBe('смотри')
    expect(w.find('.chat__thumb').exists()).toBe(false)
    expect(w.find('.chat__img').attributes('src')).toBe('/api/realtime/attachments/3')
  })

  it('слишком большой или не тот файл отклоняется на клиенте', async () => {
    const w = setup()
    await flushPromises()
    const input = w.find('[data-testid="chat-file"]')
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [big], configurable: true })
    await input.trigger('change')
    expect(w.text()).toContain('больше 10 МБ')
    expect(w.find('.chat__thumb').exists()).toBe(false)
    expect(uploadMock).not.toHaveBeenCalled()
  })
})
