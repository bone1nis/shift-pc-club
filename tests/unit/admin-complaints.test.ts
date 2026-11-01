// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  createMemoryKeyStore,
  E2eeError,
  fingerprintOfKey,
  generateOwnerKeyPair,
  sealToRecipient,
} from '../../packages/e2ee/src'
import {
  createComplaintsService,
  decryptMessages,
  recoveryErrorMessage,
  type ComplaintRow,
} from '../../apps/admin/src/pages/complaints/lib/complaintsService'
import { menuFor } from '../../apps/admin/src/widgets/admin-shell/lib/menu'
import { canUseComplaints } from '../../apps/admin/src/shared/lib/role'

/** Мини-сервер Club: хранит ключи владельца и их бэкапы. */
function fakeServer() {
  const keys: { ownerKeyId: number; publicKey: string; active: boolean; blob: string }[] = []
  const calls: { path: string; body?: Record<string, unknown> }[] = []
  const api = vi.fn(async (path: string, options: RequestInit = {}) => {
    const body = options.body
      ? (JSON.parse(String(options.body)) as Record<string, unknown>)
      : undefined
    calls.push({ path, body })
    if (path === '/api/club/owner-key') {
      const active = keys.find((k) => k.active)
      if (!active) throw Object.assign(new Error('not found'), { status: 404 })
      return { ownerKeyId: active.ownerKeyId, publicKey: active.publicKey }
    }
    if (path === '/api/club/owner/key') {
      keys.forEach((k) => (k.active = false))
      const row = {
        ownerKeyId: keys.length + 1,
        publicKey: body!.publicKey as string,
        active: true,
        blob: body!.backup as string,
      }
      keys.push(row)
      return { ownerKeyId: row.ownerKeyId, publicKey: row.publicKey }
    }
    if (path === '/api/club/owner/key-backup')
      return keys.map((k) => ({ ...k, version: 1, createdAt: '' }))
    throw new Error(`unexpected ${path}`)
  })
  const apiPage = vi.fn(async () => ({ data: [], meta: {} }))
  return { api: api as never, apiPage: apiPage as never, keys, calls }
}

const complaintFor = async (
  publicKey: string,
  ownerKeyId: number,
  text: unknown,
): Promise<ComplaintRow> => {
  const sealed = await sealToRecipient(JSON.stringify(text), publicKey, {
    ownerKeyId,
    meta: 'staff',
  })
  return {
    id: 7,
    category: 'staff',
    rating: 2,
    status: 'new',
    ownerKeyId,
    ephemeralPublicKey: sealed.ephemeralPublicKey,
    nonce: sealed.nonce,
    ciphertext: sealed.ciphertext,
    createdAt: '2026-10-16T10:00:00+00:00',
  }
}

const make = (server: ReturnType<typeof fakeServer>, store = createMemoryKeyStore()) =>
  createComplaintsService({ api: server.api, apiPage: server.apiPage, store })

describe('owner setup wizard', () => {
  it('saves the private key locally and sends public key + backup blob only', async () => {
    const server = fakeServer()
    const store = createMemoryKeyStore()
    const svc = make(server, store)
    expect((await svc.loadKeyState()).kind).toBe('none')

    const prepared = await svc.prepareKey()
    // до подтверждения «я записал код» на сервер ничего не уходит
    expect(server.calls.some((c) => c.path === '/api/club/owner/key')).toBe(false)
    const id = await svc.commitKey(prepared)

    const put = server.calls.find((c) => c.path === '/api/club/owner/key')!
    expect(put.body!.publicKey).toBe(prepared.key.publicKeyEncoded)
    expect(JSON.stringify(put.body)).not.toContain(prepared.code)
    expect(JSON.parse(put.body!.backup as string).wrappedKey).toBeTruthy()
    expect(await store.get(String(id))).not.toBeNull()
    const state = await svc.loadKeyState()
    expect(state.kind).toBe('ready')
    expect(state.kind !== 'none' && state.fingerprint).toBe(
      await fingerprintOfKey(prepared.key.publicKeyEncoded),
    )
  })
})

describe('reading complaints', () => {
  it('decrypts text, booking link and author name', async () => {
    const server = fakeServer()
    const svc = make(server)
    const id = await svc.commitKey(await svc.prepareKey())
    const row = await complaintFor(server.keys[0]!.publicKey, id, {
      text: 'Грубый администратор',
      bookingId: 42,
      authorName: 'Анна',
    })
    expect(await svc.decrypt(row)).toEqual({
      ok: true,
      content: { text: 'Грубый администратор', bookingId: 42, authorName: 'Анна' },
    })
  })

  it('reports a clear error for a foreign or missing key', async () => {
    const server = fakeServer()
    const svc = make(server)
    const id = await svc.commitKey(await svc.prepareKey())
    const other = await generateOwnerKeyPair(1)
    const foreign = await complaintFor(other.key.publicKeyEncoded, id, { text: 'секрет' })
    expect(await svc.decrypt(foreign)).toEqual({ ok: false, reason: 'decrypt_failed' })
    expect(await svc.decrypt({ ...foreign, ownerKeyId: 99 })).toEqual({
      ok: false,
      reason: 'no_key',
    })
    expect(decryptMessages.decrypt_failed).toContain('восстановите ключ')
  })
})

describe('recovery', () => {
  it('restores keys on a clean device; rotated old complaints need the old code', async () => {
    const server = fakeServer()
    const first = make(server)
    const p1 = await first.prepareKey()
    const id1 = await first.commitKey(p1)
    const row = await complaintFor(server.keys[0]!.publicKey, id1, { text: 'старая' })
    const p2 = await first.prepareKey()
    await first.commitKey(p2) // ротация
    expect((await first.decrypt(row)).ok).toBe(true) // старый ключ остался на устройстве

    const fresh = make(server)
    expect((await fresh.loadKeyState()).kind).toBe('missing')
    expect(await fresh.restore(p2.code)).toEqual({ restored: 1, skipped: 1 })
    expect((await fresh.loadKeyState()).kind).toBe('ready')
    expect((await fresh.decrypt(row)).ok).toBe(false)
    // код принимается в любом регистре и с дефисами
    await fresh.restore(p1.code.toLowerCase().replace(/(.{4})/g, '$1-'))
    expect(await fresh.decrypt(row)).toMatchObject({ ok: true, content: { text: 'старая' } })
  })

  it('lost code: a new key can be created without the old one; old complaints stay unreadable', async () => {
    const server = fakeServer()
    const first = make(server)
    const id1 = await first.commitKey(await first.prepareKey())
    const row = await complaintFor(server.keys[0]!.publicKey, id1, { text: 'старая' })

    const fresh = make(server) // чистое устройство, кода нет
    expect((await fresh.loadKeyState()).kind).toBe('missing')
    const p2 = await fresh.prepareKey()
    await fresh.commitKey(p2)
    expect((await fresh.loadKeyState()).kind).toBe('ready')
    expect(server.keys.map((k) => k.active)).toEqual([false, true])
    expect(server.keys).toHaveLength(2) // старый ключ остался в истории
    expect(await fresh.decrypt(row)).toEqual({ ok: false, reason: 'no_key' })
    const next = await complaintFor(server.keys[1]!.publicKey, 2, { text: 'новая' })
    expect(await fresh.decrypt(next)).toMatchObject({ ok: true, content: { text: 'новая' } })
  })

  it('rejects a wrong recovery code with a friendly message', async () => {
    const server = fakeServer()
    const svc = make(server)
    await svc.commitKey(await svc.prepareKey())
    const wrong = (await generateOwnerKeyPair(1)).code
    const failure = await svc.restore(wrong).catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(E2eeError)
    expect((failure as E2eeError).code).toBe('bad_recovery_code')
    expect(recoveryErrorMessage(failure)).toContain('Код восстановления не подошёл')
    const malformed = await svc.restore('abc').catch((e: unknown) => e)
    expect(recoveryErrorMessage(malformed)).toContain('Код восстановления не подошёл')
  })
})

describe('role access', () => {
  it('only the owner sees the complaints section', () => {
    expect(canUseComplaints('owner')).toBe(true)
    expect(canUseComplaints('admin')).toBe(false)
    expect(canUseComplaints(undefined)).toBe(false)
    expect(menuFor('owner').some(([path]) => path === '/complaints')).toBe(true)
    expect(menuFor('admin').some(([path]) => path === '/complaints')).toBe(false)
  })
})
