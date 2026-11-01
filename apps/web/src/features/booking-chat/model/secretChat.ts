import { z } from 'zod'
import {
  E2eeError,
  ENVELOPE_VERSION,
  decryptWithDevice,
  encryptForDevices,
  exportPublicKey,
  fingerprint,
  generateDeviceKeyPair,
  type DeviceKeyPair,
  type KeyStore,
} from '@shift/e2ee'
import {
  chatMessageSchema,
  deviceKeySchema,
  type ChatMessage,
  type DeviceKey,
} from '@shift/contracts'
import { ApiFailure } from '@fsd/shared/api'

/** Сколько раз повторяем отправку после 422 envelopes_mismatch (набор устройств мог измениться). */
export const MISMATCH_RETRIES = 2

export type SecretMessage = Extract<ChatMessage, { kind: 'secret' }>

export type SecretErrorCode =
  'no_recipients' | 'no_envelope' | 'unavailable' | 'mismatch' | 'keys_changed'

export class SecretError extends Error {
  constructor(
    readonly code: SecretErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'SecretError'
  }
}

export const STORE_UNAVAILABLE_TEXT = 'Не удалось получить доступ к хранилищу ключей в браузере'

export const NO_ENVELOPE_TEXT =
  'Это сообщение отправлено до вашего подключения или на другое устройство, прочитать его нельзя.'

/** Дополнительные данные (AAD): известны обеим сторонам без сервера. */
export const secretMeta = (bookingId: number) => `booking:${bookingId}:secret`

/** Понятный текст ошибки секретов (E2eeError, SecretError и обычные ошибки API). */
export function secretFailure(error: unknown): string {
  if (error instanceof SecretError) return error.message
  if (error instanceof E2eeError)
    return 'Не удалось расшифровать сообщение: оно повреждено или ключ не подходит.'
  if (error instanceof ApiFailure) {
    if (error.status === 403) return 'Вы не можете писать в этот чат: вас заглушили.'
    if (error.status === 409) return 'Чат закрыт: бронь завершена или отменена.'
    if (error.status === 429) return 'Слишком часто. Подождите пару секунд и повторите.'
  }
  return error instanceof Error ? error.message : 'Не удалось выполнить действие с секретом.'
}

interface StoredDevice extends DeviceKeyPair {
  deviceId?: number
}
export interface LocalDevice {
  deviceId: number
  privateKey: CryptoKey
  publicKey: string
}

export interface SecretChatDeps {
  bookingId: number
  userId: number
  api: <T>(path: string, options?: RequestInit) => Promise<T>
  store: KeyStore
  /** Для отметок «проверено»; null - не хранить. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  label?: string
}

export interface PeerFingerprint {
  userId: number
  deviceId: number
  publicKey: string
  fingerprint: string
}

const keysSchema = z.array(deviceKeySchema)
const registeredSchema = deviceKeySchema

export function createSecretChat(deps: SecretChatDeps) {
  const base = `/api/realtime/conversations/${deps.bookingId}`
  const keyId = `device:${deps.userId}`
  const meta = secretMeta(deps.bookingId)
  let devicePromise: Promise<LocalDevice> | null = null

  /** Ошибки IndexedDB (приватный режим, заблокированное хранилище) переводим в понятный текст. */
  async function withStore<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op()
    } catch {
      throw new SecretError('unavailable', STORE_UNAVAILABLE_TEXT)
    }
  }

  async function register(force: boolean): Promise<LocalDevice> {
    let stored = force
      ? null
      : ((await withStore(() => deps.store.get(keyId))) as StoredDevice | null)
    for (let attempt = 0; attempt < 3; attempt++) {
      if (stored?.deviceId !== undefined)
        return {
          deviceId: stored.deviceId,
          privateKey: stored.privateKey,
          publicKey: await exportPublicKey(stored.publicKey),
        }
      const pair = stored ?? (await generateDeviceKeyPair())
      const publicKey = await exportPublicKey(pair.publicKey)
      // Пара сохраняется до регистрации: если хранилище недоступно, на сервере не появится устройство
      // с потерянным приватным ключом, а повторная попытка регистрации возьмёт ту же пару.
      if (!stored) await withStore(() => deps.store.put(keyId, pair))
      try {
        const body: { publicKey: string; label?: string } = { publicKey }
        if (deps.label) body.label = deps.label
        const created = registeredSchema.parse(
          await deps.api('/api/realtime/devices', { method: 'POST', body: JSON.stringify(body) }),
        )
        await withStore(() =>
          deps.store.put(keyId, Object.assign({}, pair, { deviceId: created.deviceId })),
        )
        return { deviceId: created.deviceId, privateKey: pair.privateKey, publicKey }
      } catch (e) {
        // Ключ уже отозван на сервере: нужна новая пара.
        if (e instanceof ApiFailure && e.status === 409) {
          stored = null
          continue
        }
        throw e
      }
    }
    throw new SecretError('unavailable', 'Не удалось зарегистрировать ключ этого устройства.')
  }

  /** Пара ключей этого устройства: из IndexedDB или новая (регистрируется на сервере). */
  function ensureDevice(force = false): Promise<LocalDevice> {
    if (force || !devicePromise) {
      devicePromise = register(force)
      devicePromise.catch(() => {
        devicePromise = null
      })
    }
    return devicePromise
  }

  async function fetchKeys(): Promise<DeviceKey[]> {
    return keysSchema.parse(await deps.api(`${base}/keys`))
  }

  /** Шифрует под все активные устройства участников; открытый текст из функции не уходит. */
  async function sendSecret(text: string): Promise<SecretMessage> {
    let device = await ensureDevice()
    for (let attempt = 0; ; attempt++) {
      let keys = await fetchKeys()
      if (!keys.some((k) => k.deviceId === device.deviceId)) {
        // Наше устройство сервер не знает (отозвано): регистрируем новую пару.
        device = await ensureDevice(true)
        keys = await fetchKeys()
      }
      if (!keys.some((k) => k.userId !== deps.userId))
        throw new SecretError(
          'no_recipients',
          'Ни у одного участника ещё нет ключа: секрет некому будет прочитать. Пусть они откроют чат на своём устройстве.',
        )
      // Проверенному участнику подсунули новый ключ (в том числе сервер): без повторной сверки не шифруем.
      const changed = changedUsers(keys)
      if (changed.length)
        throw new SecretError(
          'keys_changed',
          'У проверенного участника изменился ключ. Сверьте отпечатки заново («Проверить участников»), потом отправляйте секрет.',
        )
      const encrypted = await encryptForDevices(
        text,
        keys.map((k) => ({ deviceId: k.deviceId, publicKey: k.publicKey })),
        { meta },
      )
      try {
        const sent = await deps.api<unknown>(`${base}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            kind: 'secret',
            ciphertext: encrypted.ciphertext,
            nonce: encrypted.nonce,
            envelopes: encrypted.envelopes,
          }),
        })
        const parsed = chatMessageSchema.parse(sent)
        if (parsed.kind !== 'secret')
          throw new SecretError('unavailable', 'Сервер вернул неожиданный ответ.')
        return parsed
      } catch (e) {
        if (e instanceof ApiFailure && e.status === 422 && e.code === 'envelopes_mismatch') {
          if (attempt >= MISMATCH_RETRIES)
            throw new SecretError(
              'mismatch',
              'Состав устройств участников всё время меняется. Повторите отправку чуть позже.',
            )
          continue
        }
        throw e
      }
    }
  }

  /** Расшифровка по запросу: текст возвращается вызывающему и больше нигде не хранится. */
  async function decrypt(message: SecretMessage): Promise<string> {
    if (message.redacted || !message.ciphertext || !message.nonce || !message.envelopes)
      throw new SecretError('unavailable', 'Текст этого секрета вам недоступен.')
    const device = await ensureDevice()
    if (!message.envelopes.some((e) => String(e.deviceId) === String(device.deviceId)))
      throw new SecretError('no_envelope', NO_ENVELOPE_TEXT)
    return decryptWithDevice(
      {
        v: ENVELOPE_VERSION,
        ciphertext: message.ciphertext,
        nonce: message.nonce,
        envelopes: message.envelopes,
      },
      device.deviceId,
      device.privateKey,
      { meta },
    )
  }

  // ---- сверка отпечатков ----

  async function peerFingerprints(keys: DeviceKey[]): Promise<PeerFingerprint[]> {
    const mine = (await ensureDevice()).publicKey
    const out: PeerFingerprint[] = []
    for (const k of keys.filter((x) => x.userId !== deps.userId))
      out.push({
        userId: k.userId,
        deviceId: k.deviceId,
        publicKey: k.publicKey,
        fingerprint: await fingerprint(mine, k.publicKey),
      })
    return out
  }

  const verifiedKey = `pcclub:chat-verified:${deps.userId}`
  function readVerified(): Record<string, string[]> {
    try {
      const raw = deps.storage?.getItem(verifiedKey)
      const parsed = z.record(z.string(), z.array(z.string())).safeParse(raw ? JSON.parse(raw) : {})
      return parsed.success ? parsed.data : {}
    } catch {
      return {}
    }
  }
  /** Запоминает ключи участника, которые пользователь сверил. */
  function markVerified(userId: number, publicKeys: string[]) {
    try {
      deps.storage?.setItem(
        verifiedKey,
        JSON.stringify({ ...readVerified(), [String(userId)]: publicKeys }),
      )
    } catch {
      /* хранилище недоступно: отметка живёт только до перезагрузки */
    }
  }
  function isVerified(userId: number): boolean {
    return String(userId) in readVerified()
  }
  /** Проверенные участники, у которых появился ключ, которого мы не сверяли. */
  function changedUsers(keys: DeviceKey[]): number[] {
    const verified = readVerified()
    const ids = new Set<number>()
    for (const k of keys) {
      const known = verified[String(k.userId)]
      if (k.userId !== deps.userId && known && !known.includes(k.publicKey)) ids.add(k.userId)
    }
    return [...ids]
  }

  return {
    ensureDevice,
    fetchKeys,
    sendSecret,
    decrypt,
    peerFingerprints,
    markVerified,
    isVerified,
    changedUsers,
  }
}

export type SecretChat = ReturnType<typeof createSecretChat>
