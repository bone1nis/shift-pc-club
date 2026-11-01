import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

const apiMock = vi.fn()
const sc = {
  ensureDevice: vi.fn(async () => ({ deviceId: 1, publicKey: 'k', privateKey: {} })),
  fetchKeys: vi.fn(),
  sendSecret: vi.fn(),
  decrypt: vi.fn(),
  peerFingerprints: vi.fn(async () => []),
  markVerified: vi.fn(),
  isVerified: vi.fn(() => true),
  changedUsers: vi.fn((): number[] => []),
}
vi.mock('@fsd/features/booking-chat/model/secretChat', async (orig) => ({
  ...(await orig<object>()),
  createSecretChat: () => sc,
}))
vi.mock('@shift/ui', async (orig) => ({
  ...(await orig<object>()),
  useRealtime: () => ({
    isLive: ref(true),
    presence: () => ({ whisper: vi.fn(), leave: vi.fn() }),
  }),
  useRealtimeChannel: () => undefined,
}))
vi.mock('@fsd/entities/user', () => ({ useUserStore: () => ({ user: { id: 1 } }) }))
vi.mock('@fsd/shared/api', async (orig) => ({
  ...(await orig<typeof import('@fsd/shared/api')>()),
  api: (...a: unknown[]) => apiMock(...a),
  apiParsed: async (schema: { parse(v: unknown): unknown }, ...a: unknown[]) =>
    schema.parse(await apiMock(...a)),
}))

import { BookingChat } from '@fsd/features/booking-chat'
import { SecretError, NO_ENVELOPE_TEXT } from '@fsd/features/booking-chat'

const secret = {
  id: 3,
  conversationId: 1,
  senderId: 2,
  kind: 'secret' as const,
  body: null,
  ciphertext: 'AAAA',
  nonce: 'AAAA',
  envelopes: [{ deviceId: 1, ephemeralPublicKey: 'AAAA', nonce: 'AAAA', wrappedKey: 'AAAA' }],
  createdAt: '2026-10-16T10:00:00+00:00',
}
const keys = [
  { deviceId: 1, userId: 1, publicKey: 'a', createdAt: '2026-10-16T10:00:00+00:00' },
  { deviceId: 2, userId: 2, publicKey: 'b', createdAt: '2026-10-16T10:00:00+00:00' },
]

async function setup() {
  apiMock.mockImplementation(async (path: string) =>
    path.includes('/messages')
      ? [secret]
      : {
          id: 1,
          bookingId: 5,
          closed: false,
          muted: false,
          moderated: true,
          participants: [
            { userId: 1, role: 'owner', muted: false },
            { userId: 2, role: 'member', muted: false },
          ],
        },
  )
  const w = mount(BookingChat, {
    props: { bookingId: 5, initialOpen: true },
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
    },
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  Object.defineProperty(document, 'hasFocus', { value: () => true, configurable: true })
  sc.fetchKeys.mockResolvedValue(keys)
  sc.decrypt.mockReset()
  sc.changedUsers.mockReturnValue([])
})

describe('секреты в чате', () => {
  it('текст появляется только по нажатию и скрывается обратно', async () => {
    sc.decrypt.mockResolvedValue('пароль 123')
    const w = await setup()
    expect(w.text()).toContain('Секретное сообщение, нажми, чтобы показать')
    expect(w.text()).not.toContain('пароль 123')
    expect(sc.decrypt).not.toHaveBeenCalled()
    await w.find('.secret button').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('пароль 123')
    expect(w.text()).toContain('Скриншот и копирование защитить нельзя')
    await w
      .findAll('.secret button')
      .find((b) => b.text() === 'Скрыть')!
      .trigger('click')
    expect(w.text()).not.toContain('пароль 123')
  })

  it('нет конверта для устройства: понятное сообщение', async () => {
    sc.decrypt.mockRejectedValue(new SecretError('no_envelope', NO_ENVELOPE_TEXT))
    const w = await setup()
    await w.find('.secret button').trigger('click')
    await flushPromises()
    expect(w.find('[role=alert]').text()).toBe(NO_ENVELOPE_TEXT)
  })

  it('временная ошибка не блокирует кнопку: можно повторить и открыть текст', async () => {
    sc.decrypt
      .mockRejectedValueOnce(
        new SecretError('unavailable', 'Не удалось получить доступ к хранилищу ключей в браузере'),
      )
      .mockResolvedValueOnce('пароль 456')
    const w = await setup()
    await w.find('.secret button').trigger('click')
    await flushPromises()
    expect(w.find('[role=alert]').text()).toBe(
      'Не удалось получить доступ к хранилищу ключей в браузере',
    )
    expect(w.find('.secret button').attributes('disabled')).toBeUndefined()
    expect(w.find('.secret button').text()).toBe('Повторить')
    await w.find('.secret button').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('пароль 456')
  })

  it('смена ключа проверенного участника показывает предупреждение в панели и ленте', async () => {
    sc.changedUsers.mockReturnValue([2])
    const w = await setup()
    expect(w.text()).toContain('У участника изменился ключ — проверьте заново')
    expect(w.find('.chat__changed').exists()).toBe(true)
  })

  it('участник без ключа указан в предупреждении, кнопка секрета подписана', async () => {
    sc.fetchKeys.mockResolvedValue([keys[0]])
    const w = await setup()
    expect(w.text()).toContain('Не смогут прочитать секрет')
    expect(w.text()).toContain('Игрок #2')
    expect(w.find('button[aria-label="Отправить секретное сообщение"]').exists()).toBe(true)
  })
})
