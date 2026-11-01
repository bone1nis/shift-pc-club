// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createMemoryKeyStore, exportPublicKey, generateDeviceKeyPair } from '@shift/e2ee'
import { ApiFailure } from '@fsd/shared/api'
import {
  NO_ENVELOPE_TEXT,
  STORE_UNAVAILABLE_TEXT,
  SecretError,
  createSecretChat,
  secretFailure,
  type SecretMessage,
} from '../../apps/web/src/features/booking-chat/model/secretChat'

interface Device {
  deviceId: number
  userId: number
  publicKey: string
  createdAt: string
}

/** Мини-сервер: реестр устройств, ключи, приём секретов с проверкой набора конвертов. */
function fakeServer(opts: { mismatchOnce?: boolean; existing?: Device[] } = {}) {
  const devices: Device[] = [...(opts.existing ?? [])]
  const posts: string[] = []
  let mismatchLeft = opts.mismatchOnce ? 1 : 0
  let seq = 100
  const asUser = (userId: number) => async (path: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET'
    if (path === '/api/realtime/devices' && method === 'POST') {
      const { publicKey } = JSON.parse(String(options?.body))
      let d = devices.find((x) => x.publicKey === publicKey)
      if (!d) {
        d = { deviceId: ++seq, userId, publicKey, createdAt: '2026-10-16T10:00:00+00:00' }
        devices.push(d)
      }
      return d
    }
    if (path.endsWith('/keys')) return devices
    if (path.endsWith('/messages') && method === 'POST') {
      const raw = String(options?.body)
      posts.push(raw)
      const body = JSON.parse(raw)
      if (mismatchLeft > 0) {
        mismatchLeft--
        throw new ApiFailure(422, {}, 'mismatch', 'envelopes_mismatch')
      }
      const given = body.envelopes.map((e: { deviceId: number }) => e.deviceId).sort()
      const active = devices.map((d) => d.deviceId).sort()
      if (JSON.stringify(given) !== JSON.stringify(active))
        throw new ApiFailure(422, {}, 'mismatch', 'envelopes_mismatch')
      return {
        id: 7,
        conversationId: 1,
        senderId: userId,
        kind: 'secret',
        body: null,
        ciphertext: body.ciphertext,
        nonce: body.nonce,
        envelopes: body.envelopes,
        createdAt: '2026-10-16T10:00:00+00:00',
      }
    }
    throw new Error(`unexpected ${method} ${path}`)
  }
  return { devices, posts, asUser }
}

async function peer(userId: number, deviceId: number): Promise<Device> {
  const pair = await generateDeviceKeyPair()
  return {
    deviceId,
    userId,
    publicKey: await exportPublicKey(pair.publicKey),
    createdAt: '2026-10-16T10:00:00+00:00',
  }
}
const storage = () => {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}
const make = (
  server: ReturnType<typeof fakeServer>,
  userId: number,
  store = createMemoryKeyStore(),
) =>
  createSecretChat({
    bookingId: 5,
    userId,
    api: server.asUser(userId) as never,
    store,
    storage: storage(),
  })

describe('секретные сообщения', () => {
  it('шифруется под все устройства, открытого текста в запросе нет, получатель читает', async () => {
    const friendDevice = await peer(2, 50)
    const server = fakeServer({ existing: [friendDevice] })
    const me = make(server, 1)
    const sent = await me.sendSecret('пароль: Hunter2-лобби')
    expect(server.posts[0]).not.toContain('Hunter2')
    expect(server.posts[0]).not.toContain('пароль')
    expect(JSON.parse(server.posts[0]!).envelopes).toHaveLength(2)
    expect(server.posts[0]).not.toContain('"v"')
    // автор читает своё устройство, повторная регистрация идемпотентна
    expect(await me.decrypt(sent)).toBe('пароль: Hunter2-лобби')
  })

  it('второй участник расшифровывает своим устройством', async () => {
    const server = fakeServer()
    const aStore = createMemoryKeyStore()
    const bStore = createMemoryKeyStore()
    const a = make(server, 1, aStore)
    const b = make(server, 2, bStore)
    await b.ensureDevice()
    const sent = await a.sendSecret('код 4242')
    expect(await b.decrypt(sent)).toBe('код 4242')
    // устройство сохранено вместе с deviceId: после "перезагрузки" регистрация не нужна
    const again = make(server, 2, bStore)
    expect((await again.ensureDevice()).deviceId).toBe((await b.ensureDevice()).deviceId)
    expect(server.devices).toHaveLength(2)
  })

  it('при 422 envelopes_mismatch перезапрашивает ключи и повторяет', async () => {
    const server = fakeServer({ existing: [await peer(2, 50)], mismatchOnce: true })
    await make(server, 1).sendSecret('секрет')
    expect(server.posts).toHaveLength(2)
  })

  it('после двух повторов сдаётся с понятной ошибкой', async () => {
    const server = fakeServer({ existing: [await peer(2, 50)] })
    const api = server.asUser(1)
    const me = createSecretChat({
      bookingId: 5,
      userId: 1,
      store: createMemoryKeyStore(),
      api: (async (path: string, o?: RequestInit) => {
        if (path.endsWith('/messages')) throw new ApiFailure(422, {}, 'x', 'envelopes_mismatch')
        return api(path, o)
      }) as never,
    })
    await expect(me.sendSecret('s')).rejects.toBeInstanceOf(SecretError)
  })

  it('без устройств других участников отправка запрещена', async () => {
    const server = fakeServer()
    await expect(make(server, 1).sendSecret('один')).rejects.toMatchObject({
      code: 'no_recipients',
    })
    expect(server.posts).toHaveLength(0)
  })

  it('нет конверта для устройства: понятное сообщение', async () => {
    const server = fakeServer({ existing: [await peer(2, 50)] })
    const sent = await make(server, 1).sendSecret('старое')
    // новый участник подключился позже
    const late = make(server, 3)
    await expect(late.decrypt(sent)).rejects.toMatchObject({ code: 'no_envelope' })
    expect(secretFailure(new SecretError('no_envelope', NO_ENVELOPE_TEXT))).toBe(NO_ENVELOPE_TEXT)
  })

  it('испорченный шифртекст даёт E2eeError с понятным текстом', async () => {
    const server = fakeServer({ existing: [await peer(2, 50)] })
    const me = make(server, 1)
    const sent = (await me.sendSecret('x')) as SecretMessage
    const broken = { ...sent, ciphertext: sent.nonce } as SecretMessage
    const error = await me.decrypt(broken).catch((e) => e)
    expect(secretFailure(error)).toContain('Не удалось расшифровать')
  })

  it('отозванный ключ (409) заменяется новой парой', async () => {
    const server = fakeServer()
    const api = server.asUser(1)
    let first = true
    const me = createSecretChat({
      bookingId: 5,
      userId: 1,
      store: createMemoryKeyStore(),
      api: (async (path: string, o?: RequestInit) => {
        if (path === '/api/realtime/devices' && first) {
          first = false
          throw new ApiFailure(409, {}, 'revoked')
        }
        return api(path, o)
      }) as never,
    })
    const device = await me.ensureDevice()
    expect(device.deviceId).toBeGreaterThan(100)
    expect(server.devices).toHaveLength(1)
  })

  it('сверка: отпечатки 12x5, смена ключа проверенного участника даёт предупреждение', async () => {
    const friend = await peer(2, 50)
    const server = fakeServer({ existing: [friend] })
    const me = make(server, 1)
    await me.ensureDevice()
    const prints = await me.peerFingerprints(await me.fetchKeys())
    expect(prints).toHaveLength(1)
    expect(prints[0]!.fingerprint.split(' ')).toHaveLength(12)
    expect(prints[0]!.fingerprint).toMatch(/^(\d{5} ){11}\d{5}$/)

    expect(me.isVerified(2)).toBe(false)
    me.markVerified(2, [friend.publicKey])
    expect(me.isVerified(2)).toBe(true)
    expect(me.changedUsers(await me.fetchKeys())).toEqual([])

    server.devices.push(await peer(2, 51))
    expect(me.changedUsers(await me.fetchKeys())).toEqual([2])
  })

  it('новый ключ у проверенного участника блокирует отправку секрета до повторной сверки', async () => {
    const friend = await peer(2, 50)
    const server = fakeServer({ existing: [friend] })
    const me = make(server, 1)
    await me.ensureDevice()
    me.markVerified(2, [friend.publicKey])
    server.devices.push(await peer(2, 51))
    await expect(me.sendSecret('пароль')).rejects.toMatchObject({ code: 'keys_changed' })
    expect(server.posts).toHaveLength(0)
    me.markVerified(
      2,
      server.devices.filter((d) => d.userId === 2).map((d) => d.publicKey),
    )
    await expect(me.sendSecret('пароль')).resolves.toMatchObject({ kind: 'secret' })
  })

  it('недоступное хранилище: устройство на сервере не регистрируется', async () => {
    const server = fakeServer({ existing: [await peer(2, 50)] })
    const store = createMemoryKeyStore()
    store.put = async () => {
      throw new Error('quota')
    }
    await expect(make(server, 1, store).sendSecret('x')).rejects.toThrow(STORE_UNAVAILABLE_TEXT)
    expect(server.devices).toHaveLength(1)
  })

  it('ошибка чтения хранилища тоже даёт русский текст', async () => {
    const server = fakeServer({ existing: [await peer(2, 50)] })
    const store = createMemoryKeyStore()
    store.get = async () => {
      throw new Error('InvalidStateError')
    }
    await expect(make(server, 1, store).sendSecret('x')).rejects.toThrow(STORE_UNAVAILABLE_TEXT)
  })
})
