import { E2eeError } from './errors'
import {
  fromBase64Url,
  fromBase64UrlFixed,
  joinFields,
  toBase64Url,
  fromUtf8,
  utf8,
} from './encoding'
import { deriveSharedAesKey } from './kdf'
import { randomBytes, subtle, toPublicKey, type PublicKeyInput } from './keys'

export const SEALED_VERSION = 1

export interface SealedMessage {
  v: number
  ownerKeyId: number | string
  ephemeralPublicKey: string
  nonce: string
  ciphertext: string
}

const INFO = 'pcclub/e2ee/v1/sealed'

const aad = (v: number, keyId: number | string, ephemeral: string, meta: string) =>
  joinFields(['pcclub-sealed', v, keyId, ephemeral, meta])

/**
 * Player -> owner. One-time ECDH pair, thrown away after sealing.
 * `meta` (e.g. category) is not encrypted but is authenticated: changing it breaks decryption.
 */
export async function sealToRecipient(
  plaintext: string | Uint8Array<ArrayBuffer>,
  recipientPublicKey: PublicKeyInput,
  options: { ownerKeyId: number | string; meta?: string },
): Promise<SealedMessage> {
  const s = subtle()
  const recipient = await toPublicKey(recipientPublicKey)
  const eph = await s.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  const ephRaw = new Uint8Array(await s.exportKey('raw', eph.publicKey))
  const ephB64 = toBase64Url(ephRaw)
  const key = await deriveSharedAesKey(eph.privateKey, recipient, ephRaw, INFO, ['encrypt'])
  const nonce = randomBytes(12)
  const data = typeof plaintext === 'string' ? utf8(plaintext) : plaintext
  const ciphertext = await s.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: aad(SEALED_VERSION, options.ownerKeyId, ephB64, options.meta ?? ''),
    },
    key,
    data,
  )
  return {
    v: SEALED_VERSION,
    ownerKeyId: options.ownerKeyId,
    ephemeralPublicKey: ephB64,
    nonce: toBase64Url(nonce),
    ciphertext: toBase64Url(ciphertext),
  }
}

async function openSealedBytes(
  sealed: Pick<SealedMessage, 'ownerKeyId' | 'ephemeralPublicKey' | 'nonce' | 'ciphertext'> & {
    v?: number
  },
  privateKey: CryptoKey,
  meta: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const v = sealed.v ?? SEALED_VERSION
  if (v !== SEALED_VERSION) throw new E2eeError('bad_format', 'Unsupported sealed message version')
  const ephRaw = fromBase64Url(sealed.ephemeralPublicKey)
  const iv = fromBase64UrlFixed(sealed.nonce, 12)
  const data = fromBase64Url(sealed.ciphertext)
  try {
    const key = await deriveSharedAesKey(
      privateKey,
      await toPublicKey(sealed.ephemeralPublicKey),
      ephRaw,
      INFO,
      ['decrypt'],
    )
    const plain = await subtle().decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aad(v, sealed.ownerKeyId, sealed.ephemeralPublicKey, meta),
      },
      key,
      data,
    )
    return new Uint8Array(plain)
  } catch {
    throw new E2eeError('decrypt_failed', 'Cannot decrypt message')
  }
}

/** Owner side. Throws on any tampering. */
export async function openSealed(
  sealed: SealedMessage,
  privateKey: CryptoKey,
  options: { meta?: string } = {},
): Promise<string> {
  return fromUtf8(await openSealedBytes(sealed, privateKey, options.meta ?? ''))
}
