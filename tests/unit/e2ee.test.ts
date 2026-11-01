// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  createMemoryKeyStore,
  decryptWithDevice,
  encryptForDevices,
  exportPublicKey,
  fingerprint,
  fingerprintOfKey,
  generateDeviceKeyPair,
  generateOwnerKeyPair,
  importPublicKey,
  loadKeyPair,
  openSealed,
  restoreFromBackup,
  saveKeyPair,
  sealToRecipient,
  fromBase64Url,
  toBase64Url,
} from '../../packages/e2ee/src'

const flip = (b64: string): string => {
  const bytes = fromBase64Url(b64)
  bytes[0] = (bytes[0] as number) ^ 1
  return toBase64Url(bytes)
}

describe('sealed envelope', () => {
  it('player encrypts, owner decrypts', async () => {
    const { key } = await generateOwnerKeyPair(1)
    const sealed = await sealToRecipient('Админ грубит', key.publicKeyEncoded, {
      ownerKeyId: 1,
      meta: 'staff',
    })
    expect(sealed.ciphertext).not.toContain('Админ')
    expect(await openSealed(sealed, key.privateKey, { meta: 'staff' })).toBe('Админ грубит')
  })

  it('tampering with ciphertext, key id or meta fails', async () => {
    const { key } = await generateOwnerKeyPair(1)
    const sealed = await sealToRecipient('secret', key.publicKey, { ownerKeyId: 1, meta: 'a' })
    await expect(
      openSealed({ ...sealed, ciphertext: flip(sealed.ciphertext) }, key.privateKey, { meta: 'a' }),
    ).rejects.toThrow()
    await expect(
      openSealed({ ...sealed, ownerKeyId: 2 }, key.privateKey, { meta: 'a' }),
    ).rejects.toThrow()
    await expect(openSealed(sealed, key.privateKey, { meta: 'b' })).rejects.toThrow()
  })

  it('another owner key cannot open', async () => {
    const a = await generateOwnerKeyPair(1)
    const b = await generateOwnerKeyPair(2)
    const sealed = await sealToRecipient('x', a.key.publicKey, { ownerKeyId: 1 })
    await expect(openSealed(sealed, b.key.privateKey)).rejects.toThrow()
  })

  it('nonce and ephemeral key are never reused', async () => {
    const { key } = await generateOwnerKeyPair(1)
    const items = await Promise.all(
      Array.from({ length: 50 }, () => sealToRecipient('same', key.publicKey, { ownerKeyId: 1 })),
    )
    expect(new Set(items.map((i) => i.nonce)).size).toBe(50)
    expect(new Set(items.map((i) => i.ephemeralPublicKey)).size).toBe(50)
    expect(new Set(items.map((i) => i.ciphertext)).size).toBe(50)
  })
})

describe('multi-device envelope', () => {
  it('two devices read, third (no envelope) does not, new device does not read old', async () => {
    const d1 = await generateDeviceKeyPair()
    const d2 = await generateDeviceKeyPair()
    const d3 = await generateDeviceKeyPair()
    const msg = await encryptForDevices(
      'секрет',
      [
        { deviceId: 1, publicKey: await exportPublicKey(d1.publicKey) },
        { deviceId: 2, publicKey: d2.publicKey },
      ],
      { meta: 'booking:7' },
    )
    expect(msg.envelopes).toHaveLength(2)
    const opt = { meta: 'booking:7' }
    expect(await decryptWithDevice(msg, 1, d1.privateKey, opt)).toBe('секрет')
    expect(await decryptWithDevice(msg, 2, d2.privateKey, opt)).toBe('секрет')
    await expect(decryptWithDevice(msg, 3, d3.privateKey, opt)).rejects.toThrow()
    // third device pretending to be device 1
    await expect(decryptWithDevice(msg, 1, d3.privateKey, opt)).rejects.toThrow()
  })

  it('tampering fails', async () => {
    const d = await generateDeviceKeyPair()
    const msg = await encryptForDevices('hello', [{ deviceId: 1, publicKey: d.publicKey }])
    await expect(
      decryptWithDevice({ ...msg, ciphertext: flip(msg.ciphertext) }, 1, d.privateKey),
    ).rejects.toThrow()
    const env = { ...msg.envelopes[0]!, wrappedKey: flip(msg.envelopes[0]!.wrappedKey) }
    await expect(decryptWithDevice({ ...msg, envelopes: [env] }, 1, d.privateKey)).rejects.toThrow()
    await expect(decryptWithDevice(msg, 1, d.privateKey, { meta: 'other' })).rejects.toThrow()
    // an envelope moved to another deviceId is rejected via AAD
    const moved = { ...msg, envelopes: [{ ...msg.envelopes[0]!, deviceId: 9 }] }
    await expect(decryptWithDevice(moved, 9, d.privateKey)).rejects.toThrow()
  })

  it('nonces are unique across messages and envelopes', async () => {
    const d = await generateDeviceKeyPair()
    const msgs = await Promise.all(
      Array.from({ length: 30 }, () =>
        encryptForDevices('x', [{ deviceId: 1, publicKey: d.publicKey }]),
      ),
    )
    const nonces = msgs.flatMap((m) => [m.nonce, ...m.envelopes.map((e) => e.nonce)])
    expect(new Set(nonces).size).toBe(nonces.length)
  })

  it('rejects empty recipient list', async () => {
    await expect(encryptForDevices('x', [])).rejects.toThrow()
  })
})

describe('fingerprint', () => {
  it('is stable, order independent, 12 groups of 5 digits', async () => {
    const a = await generateDeviceKeyPair()
    const b = await generateDeviceKeyPair()
    const ab = await fingerprint(a.publicKey, b.publicKey)
    expect(ab).toMatch(/^(\d{5} ){11}\d{5}$/)
    expect(await fingerprint(b.publicKey, a.publicKey)).toBe(ab)
    expect(await fingerprint(await exportPublicKey(a.publicKey), b.publicKey)).toBe(ab)
    expect(await fingerprint(a.publicKey)).not.toBe(ab)
    expect(await fingerprintOfKey(a.publicKey)).toBe(await fingerprint(a.publicKey))
  })
})

describe('recovery', () => {
  it('restores by code, wrong code or modified blob fails', async () => {
    const { key, code, blob } = await generateOwnerKeyPair(5)
    expect(code).toMatch(/^[A-Z2-7]{32}$/)
    const sealed = await sealToRecipient('old complaint', key.publicKey, { ownerKeyId: 5 })

    const restored = await restoreFromBackup(code, blob)
    expect(restored.keyId).toBe(5)
    expect(await openSealed(sealed, restored.privateKey)).toBe('old complaint')
    // code is accepted in grouped lowercase form
    const grouped = code.toLowerCase().match(/.{4}/g)!.join('-')
    await restoreFromBackup(grouped, blob)

    const wrong = code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A')
    await expect(restoreFromBackup(wrong, blob)).rejects.toThrow()
    await expect(restoreFromBackup('short', blob)).rejects.toThrow()
    await expect(restoreFromBackup(code, { ...blob, keyId: 6 })).rejects.toThrow()
    await expect(
      restoreFromBackup(code, { ...blob, wrappedKey: flip(blob.wrappedKey) }),
    ).rejects.toThrow()
  })

  it('codes are random', async () => {
    const codes = await Promise.all([1, 2, 3, 4].map((i) => generateOwnerKeyPair(i)))
    expect(new Set(codes.map((c) => c.code)).size).toBe(4)
  })
})

describe('key safety and storage', () => {
  it('private keys are non-extractable', async () => {
    const device = await generateDeviceKeyPair()
    expect(device.privateKey.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('pkcs8', device.privateKey)).rejects.toThrow()
    const { key, code, blob } = await generateOwnerKeyPair(1)
    expect(key.privateKey.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('pkcs8', key.privateKey)).rejects.toThrow()
    const restored = await restoreFromBackup(code, blob)
    await expect(crypto.subtle.exportKey('pkcs8', restored.privateKey)).rejects.toThrow()
  })

  it('public key round-trips and invalid input is rejected', async () => {
    const d = await generateDeviceKeyPair()
    const encoded = await exportPublicKey(d.publicKey)
    expect(await exportPublicKey(await importPublicKey(encoded))).toBe(encoded)
    await expect(importPublicKey('AAAA')).rejects.toThrow()
  })

  it('memory key store saves and loads', async () => {
    const store = createMemoryKeyStore()
    const pair = await generateDeviceKeyPair()
    expect(await loadKeyPair(store, 'k1')).toBeNull()
    await saveKeyPair(store, 'k1', pair)
    expect(await loadKeyPair(store, 'k1')).toBe(pair)
  })
})

describe('hardening', () => {
  it('wrong code gives a clear E2eeError, not a raw crypto error', async () => {
    const { code, blob } = await generateOwnerKeyPair(1)
    const wrong = code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A')
    for (const c of [wrong, 'short']) {
      await expect(restoreFromBackup(c, blob)).rejects.toMatchObject({
        name: 'E2eeError',
        code: 'bad_recovery_code',
      })
    }
    await expect(restoreFromBackup(code, { ...blob, salt: '!!' })).rejects.toMatchObject({
      code: 'bad_recovery_code',
    })
  })

  it('decrypt errors do not contain plaintext', async () => {
    const { key } = await generateOwnerKeyPair(1)
    const sealed = await sealToRecipient('TOP-SECRET-TEXT', key.publicKey, { ownerKeyId: 1 })
    const err = await openSealed({ ...sealed, ciphertext: flip(sealed.ciphertext) }, key.privateKey)
      .then(() => null)
      .catch((e: Error) => e)
    expect(err).toMatchObject({ code: 'decrypt_failed' })
    expect(String(err?.message)).not.toContain('SECRET')
  })

  it('rejects non-canonical base64url, bad lengths and invalid curve points', async () => {
    expect(() => fromBase64Url('AB')).toThrow()
    expect(() => fromBase64Url('A')).toThrow()
    expect(() => fromBase64Url('a+b/')).toThrow()
    const { key } = await generateOwnerKeyPair(1)
    const sealed = await sealToRecipient('x', key.publicKey, { ownerKeyId: 1 })
    await expect(
      openSealed({ ...sealed, nonce: toBase64Url(new Uint8Array(8)) }, key.privateKey),
    ).rejects.toThrow()
    const bad = new Uint8Array(65).fill(7)
    bad[0] = 4
    await expect(importPublicKey(toBase64Url(bad))).rejects.toThrow()
    await expect(
      openSealed({ ...sealed, ephemeralPublicKey: toBase64Url(bad) }, key.privateKey),
    ).rejects.toThrow()
    await expect(openSealed({ ...sealed, v: 2 }, key.privateKey)).rejects.toThrow()
  })
})
