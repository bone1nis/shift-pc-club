import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { exportPublicKey, generateOwnerKeyPair, openSealed } from '../../packages/e2ee/src'

const apiMock = vi.fn()
vi.mock('@fsd/entities/user', () => ({ useUserStore: () => ({ user: { id: 1, name: 'Анна' } }) }))
vi.mock('@fsd/shared/api', async (orig) => {
  const actual = await orig<typeof import('@fsd/shared/api')>()
  return {
    ...actual,
    api: (...a: unknown[]) => apiMock(...a),
    apiParsed: async (schema: { parse(v: unknown): unknown }, ...a: unknown[]) =>
      schema.parse(await apiMock(...a)),
  }
})

import { ApiFailure } from '@fsd/shared/api'
import {
  ComplaintForm,
  complaintErrorMessage,
  FINGERPRINT_STORAGE_KEY,
  loadOwnerKey,
  OwnerKeyMissing,
  submitComplaint,
} from '@fsd/features/send-complaint'

const SECRET = 'Админ Пётр хамил мне в зале, номер брони 77'

async function ownerKey(id = 3) {
  const { key } = await generateOwnerKeyPair(id)
  return { key, publicKey: await exportPublicKey(key.publicKey) }
}
const serve = (ownerKeyId: number, publicKey: string) => (path: string) => {
  if (path === '/api/club/owner-key') return Promise.resolve({ ownerKeyId, publicKey })
  if (path === '/api/booking/bookings') return Promise.resolve([])
  return Promise.resolve({ id: 1 })
}

beforeEach(() => {
  apiMock.mockReset()
  localStorage.clear()
})

describe('отправка жалобы', () => {
  it('в теле запроса нет открытого текста, а владелец расшифровывает его', async () => {
    const { key, publicKey } = await ownerKey()
    apiMock.mockImplementation(serve(3, publicKey))
    const info = await loadOwnerKey()
    expect(info.fingerprint).toMatch(/^(\d{5} ){11}\d{5}$/)
    await submitComplaint(
      { category: 'staff', rating: 2, text: SECRET, bookingId: 77, showName: true, name: 'Анна' },
      info,
    )
    const [path, options] = apiMock.mock.calls.at(-1) as [string, { method: string; body: string }]
    expect(path).toBe('/api/club/complaints')
    expect(options.body).not.toContain('Пётр')
    expect(options.body).not.toContain('Анна')
    expect(options.body).not.toContain('bookingId')
    const body = JSON.parse(options.body)
    expect(Object.keys(body).sort()).toEqual(
      ['category', 'ciphertext', 'ephemeralPublicKey', 'nonce', 'ownerKeyId', 'rating'].sort(),
    )
    const payload = JSON.parse(await openSealed({ v: 1, ...body }, key.privateKey))
    expect(payload).toEqual({ v: 1, text: SECRET, bookingId: 77, showName: true, name: 'Анна' })
  })

  it('имя не попадает в нагрузку без согласия', async () => {
    const { key, publicKey } = await ownerKey()
    apiMock.mockImplementation(serve(3, publicKey))
    await submitComplaint(
      { category: 'other', rating: 5, text: 'ok', showName: false, name: 'Анна' },
      await loadOwnerKey(),
    )
    const body = JSON.parse((apiMock.mock.calls.at(-1) as [string, { body: string }])[1].body)
    const payload = JSON.parse(await openSealed({ v: 1, ...body }, key.privateKey))
    expect(payload).toEqual({ v: 1, text: 'ok', showName: false })
  })

  it('404 на ключе владельца и 429 при отправке понятны пользователю', async () => {
    apiMock.mockRejectedValue(new ApiFailure(404))
    await expect(loadOwnerKey()).rejects.toBeInstanceOf(OwnerKeyMissing)
    expect(complaintErrorMessage(new OwnerKeyMissing())).toBe(
      'Владелец ещё не настроил приём жалоб.',
    )
    expect(complaintErrorMessage(new ApiFailure(429))).toContain('5 обращений в сутки')
    expect(complaintErrorMessage(new ApiFailure(422))).toContain('Проверьте')
    expect(complaintErrorMessage(new TypeError('fetch'))).toContain('Нет соединения')
  })
})

describe('форма жалобы', () => {
  it('показывает отпечаток и запоминает его при первом визите', async () => {
    const { publicKey } = await ownerKey()
    apiMock.mockImplementation(serve(3, publicKey))
    const w = mount(ComplaintForm)
    await vi.waitFor(() => expect(w.find('[data-testid="owner-fingerprint"]').exists()).toBe(true))
    const fp = w.get('[data-testid="owner-fingerprint"]').text()
    expect(localStorage.getItem(FINGERPRINT_STORAGE_KEY)).toBe(fp)
    expect(w.text()).not.toContain('Ключ владельца изменился')
  })

  it('предупреждает, если отпечаток ключа изменился, и блокирует отправку', async () => {
    const { publicKey } = await ownerKey()
    localStorage.setItem(
      FINGERPRINT_STORAGE_KEY,
      '00000 00000 00000 00000 00000 00000 00000 00000 00000 00000 00000 00000',
    )
    apiMock.mockImplementation(serve(4, publicKey))
    const w = mount(ComplaintForm)
    await vi.waitFor(() => expect(w.text()).toContain('Ключ владельца изменился'))
    expect(w.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await w
      .findAll('button')
      .find((b) => b.text().includes('Отпечаток сверен'))!
      .trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Ключ владельца изменился')
  })

  it('сообщает, что владелец не настроил приём жалоб (404)', async () => {
    apiMock.mockImplementation((path: string) =>
      path === '/api/club/owner-key' ? Promise.reject(new ApiFailure(404)) : Promise.resolve([]),
    )
    const w = mount(ComplaintForm)
    await vi.waitFor(() => expect(w.text()).toContain('Владелец ещё не настроил приём жалоб'))
    expect(w.find('form').exists()).toBe(false)
  })
})
