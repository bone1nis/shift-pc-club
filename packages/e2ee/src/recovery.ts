import { E2eeError } from './errors'
import { fromBase64Url, fromBase64UrlFixed, joinFields, toBase64Url, utf8 } from './encoding'
import { randomBytes, subtle, type DeviceKeyPair } from './keys'

export const RECOVERY_VERSION = 1
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const INFO = 'pcclub/e2ee/v1/recovery'

export interface RecoveryBlob {
  v: number
  keyId: number | string
  publicKey: string
  salt: string
  nonce: string
  wrappedKey: string
}

export interface OwnerKey extends DeviceKeyPair {
  keyId: number | string
  publicKeyEncoded: string
}

/** 20 random bytes (160 bits) -> 32 base32 characters. */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(20)
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  return out
}

/** Display form: XXXX-XXXX-... */
export const formatRecoveryCode = (code: string): string => code.match(/.{1,4}/g)?.join('-') ?? code

export function normalizeRecoveryCode(code: string): string {
  const clean = code.toUpperCase().replace(/[\s-]/g, '')
  if (!/^[A-Z2-7]{32}$/.test(clean))
    throw new E2eeError('bad_recovery_code', 'Invalid recovery code')
  return clean
}

async function wrappingKey(
  code: string,
  salt: Uint8Array<ArrayBuffer>,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const s = subtle()
  const base = await s.importKey('raw', utf8(normalizeRecoveryCode(code)), 'HKDF', false, [
    'deriveKey',
  ])
  return s.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: utf8(INFO) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  )
}

const backupAad = (v: number, keyId: number | string, publicKey: string) =>
  joinFields(['pcclub-recovery', v, keyId, publicKey])

/** Wraps an extractable private key. `code` is shown to the owner once and never stored. */
export async function createRecoveryBackup(
  privateKeyExtractable: CryptoKey,
  publicKey: CryptoKey,
  keyId: number | string,
): Promise<{ code: string; blob: RecoveryBlob }> {
  const s = subtle()
  const code = generateRecoveryCode()
  const salt = randomBytes(16)
  const nonce = randomBytes(12)
  const pub = toBase64Url(await s.exportKey('raw', publicKey))
  const key = await wrappingKey(code, salt, ['encrypt'])
  const pkcs8 = new Uint8Array(await s.exportKey('pkcs8', privateKeyExtractable))
  let wrapped: ArrayBuffer
  try {
    wrapped = await s.encrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: backupAad(RECOVERY_VERSION, keyId, pub) },
      key,
      pkcs8,
    )
  } finally {
    pkcs8.fill(0)
  }
  return {
    code,
    blob: {
      v: RECOVERY_VERSION,
      keyId,
      publicKey: pub,
      salt: toBase64Url(salt),
      nonce: toBase64Url(nonce),
      wrappedKey: toBase64Url(wrapped),
    },
  }
}

/** Throws on a wrong code or a modified blob. The key comes back non-extractable. */
export async function restoreFromBackup(code: string, blob: RecoveryBlob): Promise<OwnerKey> {
  if (blob.v !== RECOVERY_VERSION) throw new E2eeError('bad_format', 'Unsupported backup version')
  const s = subtle()
  const curve = { name: 'ECDH', namedCurve: 'P-256' } as const
  const clean = normalizeRecoveryCode(code)
  try {
    const key = await wrappingKey(clean, fromBase64UrlFixed(blob.salt, 16), ['decrypt'])
    const pkcs8 = await s.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64UrlFixed(blob.nonce, 12),
        additionalData: backupAad(blob.v, blob.keyId, blob.publicKey),
      },
      key,
      fromBase64Url(blob.wrappedKey),
    )
    let privateKey: CryptoKey
    try {
      privateKey = await s.importKey('pkcs8', pkcs8, curve, false, ['deriveBits'])
    } finally {
      new Uint8Array(pkcs8).fill(0)
    }
    const publicKey = await s.importKey(
      'raw',
      fromBase64UrlFixed(blob.publicKey, 65),
      curve,
      true,
      [],
    )
    return { keyId: blob.keyId, privateKey, publicKey, publicKeyEncoded: blob.publicKey }
  } catch {
    throw new E2eeError('bad_recovery_code', 'Wrong recovery code or damaged backup')
  }
}

/**
 * Owner key (also used for rotation: call again with a new keyId). The key is extractable only
 * for the duration of this call; the returned private key is re-imported from the backup as
 * non-extractable, so no extractable copy remains.
 */
export async function generateOwnerKeyPair(
  keyId: number | string,
): Promise<{ key: OwnerKey; code: string; blob: RecoveryBlob }> {
  const pair = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  const { code, blob } = await createRecoveryBackup(pair.privateKey, pair.publicKey, keyId)
  const key = await restoreFromBackup(code, blob)
  return { key, code, blob }
}
