import { E2eeError } from './errors'
import { fromBase64Url, toBase64Url } from './encoding'

export type PublicKeyInput = string | CryptoKey

export interface DeviceKeyPair {
  /** ECDH P-256, non-extractable. */
  privateKey: CryptoKey
  publicKey: CryptoKey
}

export const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error('Web Crypto API is not available')
  return s
}

export const randomBytes = (length: number): Uint8Array<ArrayBuffer> =>
  globalThis.crypto.getRandomValues(new Uint8Array(length))

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const

/** Generates a device key pair. The private key can never be exported. */
export async function generateDeviceKeyPair(): Promise<DeviceKeyPair> {
  const pair = await subtle().generateKey(ECDH, false, ['deriveBits'])
  return { privateKey: pair.privateKey, publicKey: pair.publicKey }
}

/** Public key as base64url of the raw uncompressed P-256 point (65 bytes). */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  return toBase64Url(await subtle().exportKey('raw', publicKey))
}

export async function importPublicKey(encoded: string): Promise<CryptoKey> {
  const raw = fromBase64Url(encoded)
  if (raw.length !== 65 || raw[0] !== 4) throw new E2eeError('bad_format', 'Invalid public key')
  return subtle().importKey('raw', raw, ECDH, true, [])
}

export async function toPublicKey(input: PublicKeyInput): Promise<CryptoKey> {
  return typeof input === 'string' ? importPublicKey(input) : input
}

export async function publicKeyBytes(input: PublicKeyInput): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof input === 'string') {
    const raw = fromBase64Url(input)
    await importPublicKey(input) // validates the point
    return raw
  }
  const raw = new Uint8Array(await subtle().exportKey('raw', input))
  if (raw.length !== 65 || raw[0] !== 4) throw new E2eeError('bad_format', 'Invalid public key')
  return raw
}

export async function importPrivateKeyPkcs8(pkcs8: ArrayBuffer | Uint8Array<ArrayBuffer>) {
  return subtle().importKey('pkcs8', pkcs8, ECDH, false, ['deriveBits'])
}

// ---- key storage ----

export interface KeyStore {
  put(keyId: string, pair: DeviceKeyPair): Promise<void>
  get(keyId: string): Promise<DeviceKeyPair | null>
  delete(keyId: string): Promise<void>
}

export function createMemoryKeyStore(): KeyStore {
  const map = new Map<string, DeviceKeyPair>()
  return {
    put: async (keyId, pair) => void map.set(keyId, pair),
    get: async (keyId) => map.get(keyId) ?? null,
    delete: async (keyId) => void map.delete(keyId),
  }
}

const STORE = 'keys'

/** CryptoKey objects are structured-cloneable, so non-extractable keys survive in IndexedDB. */
export function createIndexedDbKeyStore(dbName = 'shift-e2ee', factory?: IDBFactory): KeyStore {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const idb = factory ?? globalThis.indexedDB
      if (!idb) return reject(new Error('IndexedDB is not available'))
      const req = idb.open(dbName, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

  async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
    const db = await open()
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        // writes count as done only after the transaction commits (quota errors surface on abort)
        if (mode === 'readwrite') tx.oncomplete = () => resolve(req.result)
        else req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        tx.onabort = () => reject(tx.error ?? req.error)
      })
    } finally {
      db.close()
    }
  }

  return {
    put: async (keyId, pair) => void (await run('readwrite', (s) => s.put(pair, keyId))),
    get: async (keyId) =>
      ((await run('readonly', (s) => s.get(keyId))) as DeviceKeyPair | undefined) ?? null,
    delete: async (keyId) => void (await run('readwrite', (s) => s.delete(keyId))),
  }
}

export const saveKeyPair = (store: KeyStore, keyId: string, pair: DeviceKeyPair) =>
  store.put(keyId, pair)
export const loadKeyPair = (store: KeyStore, keyId: string) => store.get(keyId)
