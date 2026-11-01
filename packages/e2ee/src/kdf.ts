import { utf8 } from './encoding'
import { subtle } from './keys'

/** ECDH -> HKDF-SHA256 -> AES-GCM-256 key. Salt is the ephemeral public key; info carries version and purpose. */
export async function deriveSharedAesKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
  info: string,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const s = subtle()
  const secret = await s.deriveBits({ name: 'ECDH', public: peerPublicKey }, privateKey, 256)
  let hkdfKey: CryptoKey
  try {
    hkdfKey = await s.importKey('raw', secret, 'HKDF', false, ['deriveKey'])
  } finally {
    new Uint8Array(secret).fill(0)
  }
  return s.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: utf8(info) },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  )
}
