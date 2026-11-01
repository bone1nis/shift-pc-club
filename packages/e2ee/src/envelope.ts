import { E2eeError } from './errors'
import {
  fromBase64Url,
  fromBase64UrlFixed,
  fromUtf8,
  joinFields,
  toBase64Url,
  utf8,
} from './encoding'
import { deriveSharedAesKey } from './kdf'
import { randomBytes, subtle, toPublicKey, type PublicKeyInput } from './keys'

export const ENVELOPE_VERSION = 1
const INFO = 'pcclub/e2ee/v1/envelope'

export interface DeviceRecipient {
  deviceId: number | string
  publicKey: PublicKeyInput
}

export interface DeviceEnvelope {
  deviceId: number | string
  ephemeralPublicKey: string
  nonce: string
  wrappedKey: string
}

export interface EncryptedMessage {
  v: number
  nonce: string
  ciphertext: string
  envelopes: DeviceEnvelope[]
}

const bodyAad = (v: number, meta: string) => joinFields(['pcclub-msg', v, meta])
const wrapAad = (v: number, deviceId: number | string, meta: string) =>
  joinFields(['pcclub-wrap', v, deviceId, meta])

/**
 * Text is encrypted once with a random key K; K is wrapped separately for every device
 * (ephemeral ECDH + HKDF + AES-GCM). Devices not in the list can never read the message.
 */
export async function encryptForDevices(
  plaintext: string | Uint8Array<ArrayBuffer>,
  devices: DeviceRecipient[],
  options: { meta?: string } = {},
): Promise<EncryptedMessage> {
  if (devices.length === 0) throw new E2eeError('bad_format', 'No recipient devices')
  const s = subtle()
  const meta = options.meta ?? ''
  const messageKey = await s.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const keyRaw = new Uint8Array(await s.exportKey('raw', messageKey))
  const nonce = randomBytes(12)
  const ciphertext = await s.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: bodyAad(ENVELOPE_VERSION, meta) },
    messageKey,
    typeof plaintext === 'string' ? utf8(plaintext) : plaintext,
  )

  const envelopes: DeviceEnvelope[] = []
  try {
    for (const device of devices) {
      const pub = await toPublicKey(device.publicKey)
      const eph = await s.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
      const ephRaw = new Uint8Array(await s.exportKey('raw', eph.publicKey))
      const kek = await deriveSharedAesKey(eph.privateKey, pub, ephRaw, INFO, ['encrypt'])
      const wrapNonce = randomBytes(12)
      const wrapped = await s.encrypt(
        {
          name: 'AES-GCM',
          iv: wrapNonce,
          additionalData: wrapAad(ENVELOPE_VERSION, device.deviceId, meta),
        },
        kek,
        keyRaw,
      )
      envelopes.push({
        deviceId: device.deviceId,
        ephemeralPublicKey: toBase64Url(ephRaw),
        nonce: toBase64Url(wrapNonce),
        wrappedKey: toBase64Url(wrapped),
      })
    }
  } finally {
    keyRaw.fill(0)
  }
  return {
    v: ENVELOPE_VERSION,
    nonce: toBase64Url(nonce),
    ciphertext: toBase64Url(ciphertext),
    envelopes,
  }
}

/** Throws if there is no envelope for this device or anything was tampered with. */
export async function decryptWithDevice(
  message: EncryptedMessage,
  deviceId: number | string,
  privateKey: CryptoKey,
  options: { meta?: string } = {},
): Promise<string> {
  const v = message.v ?? ENVELOPE_VERSION
  if (v !== ENVELOPE_VERSION) throw new E2eeError('bad_format', 'Unsupported message version')
  const meta = options.meta ?? ''
  const envelope = message.envelopes.find((e) => String(e.deviceId) === String(deviceId))
  if (!envelope) throw new E2eeError('decrypt_failed', 'No envelope for this device')
  const s = subtle()
  try {
    const kek = await deriveSharedAesKey(
      privateKey,
      await toPublicKey(envelope.ephemeralPublicKey),
      fromBase64Url(envelope.ephemeralPublicKey),
      INFO,
      ['decrypt'],
    )
    const keyRaw = await s.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64UrlFixed(envelope.nonce, 12),
        additionalData: wrapAad(v, deviceId, meta),
      },
      kek,
      fromBase64Url(envelope.wrappedKey),
    )
    let messageKey: CryptoKey
    try {
      messageKey = await s.importKey('raw', keyRaw, 'AES-GCM', false, ['decrypt'])
    } finally {
      new Uint8Array(keyRaw).fill(0)
    }
    const plain = await s.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64UrlFixed(message.nonce, 12),
        additionalData: bodyAad(v, meta),
      },
      messageKey,
      fromBase64Url(message.ciphertext),
    )
    return fromUtf8(plain)
  } catch {
    throw new E2eeError('decrypt_failed', 'Cannot decrypt message')
  }
}
