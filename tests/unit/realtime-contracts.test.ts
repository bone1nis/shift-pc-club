import { describe, expect, it } from 'vitest'
import {
  accountChangedSchema,
  bookingChatChannel,
  bookingChatPresenceChannel,
  chatAttachmentSchema,
  chatMessageSchema,
  complaintCreatedSchema,
  complaintSchema,
  complaintSubmitSchema,
  deviceKeySchema,
  deviceKeyRegisterSchema,
  secretSendSchema,
  envelopesMismatchSchema,
  hallChangedSchema,
  hallChannel,
  messageReadSchema,
  ownerChannel,
  ownerPublicKeySchema,
  typingEventName,
  typingSchema,
  userChannel,
} from '../../packages/contracts/src/realtime'

const cipher = { ownerKeyId: 1, ephemeralPublicKey: 'AQ==', nonce: 'Ag==', ciphertext: 'Aw==' }

describe('realtime contracts', () => {
  it('names channels', () => {
    expect(userChannel(7)).toBe('private-user.7')
    expect(hallChannel).toBe('private-hall')
    expect(bookingChatChannel(3)).toBe('private-booking.3.chat')
    expect(bookingChatPresenceChannel(3)).toBe('presence-booking.3.chat')
    expect(ownerChannel).toBe('private-owner')
  })

  it('validates signals', () => {
    for (const s of [accountChangedSchema, hallChangedSchema, complaintCreatedSchema]) {
      expect(s.safeParse({ type: 'booking', id: 5 }).success).toBe(true)
      expect(s.safeParse({ type: 'booking' }).success).toBe(false)
      expect(s.safeParse({ type: 'booking', id: 0 }).success).toBe(false)
      expect(s.safeParse({ type: 'booking', id: 5, extra: 1 }).success).toBe(false)
    }
  })

  it('validates chat messages', () => {
    const base = { id: 1, conversationId: 2, senderId: 3, createdAt: '2026-10-16T10:00:00Z' }
    expect(chatMessageSchema.safeParse({ ...base, kind: 'text', body: 'привет' }).success).toBe(
      true,
    )
    const secret = {
      ...base,
      kind: 'secret',
      ciphertext: 'AA==',
      nonce: 'AQ==',
      envelopes: [{ deviceId: 1, ephemeralPublicKey: 'Ag==', nonce: 'Ag==', wrappedKey: 'Ag==' }],
    }
    expect(chatMessageSchema.safeParse(secret).success).toBe(true)
    expect(chatMessageSchema.safeParse({ ...secret, envelopes: [] }).success).toBe(false)
    expect(chatMessageSchema.safeParse({ ...base, kind: 'text' }).success).toBe(false)
    expect(chatMessageSchema.safeParse({ ...base, kind: 'text', body: '' }).success).toBe(false)
    expect(
      chatMessageSchema.safeParse({ ...base, kind: 'secret', body: 'открытый текст' }).success,
    ).toBe(false)
    expect(chatMessageSchema.safeParse({ ...base, kind: 'photo', body: 'x' }).success).toBe(false)
  })

  it('validates typing, read and attachments', () => {
    expect(typingEventName).toBe('client-typing')
    expect(typingSchema.safeParse({ userId: 1 }).success).toBe(true)
    expect(typingSchema.safeParse({ userId: 1, x: 1 }).success).toBe(false)
    expect(messageReadSchema.safeParse({ userId: 1, upToMessageId: 5 }).success).toBe(true)
    expect(messageReadSchema.safeParse({ userId: 1, upToMessageId: 0 }).success).toBe(false)
    const attachment = {
      id: 1,
      name: 'a.png',
      mime: 'image/png',
      size: 100,
      url: '/api/realtime/attachments/1',
    }
    expect(chatAttachmentSchema.safeParse(attachment).success).toBe(true)
    expect(chatAttachmentSchema.safeParse({ ...attachment, mime: 'image/svg+xml' }).success).toBe(
      false,
    )
    expect(chatAttachmentSchema.safeParse({ ...attachment, size: 11 * 1024 * 1024 }).success).toBe(
      false,
    )
    const base = {
      id: 1,
      conversationId: 2,
      senderId: 3,
      createdAt: '2026-10-16T10:00:00Z',
      kind: 'text',
    }
    expect(chatMessageSchema.safeParse({ ...base, body: null, attachment }).success).toBe(true)
    expect(chatMessageSchema.safeParse({ ...base, body: 'подпись', attachment }).success).toBe(true)
    expect(chatMessageSchema.safeParse({ ...base, body: null, attachment: null }).success).toBe(
      false,
    )
  })

  it('validates complaints', () => {
    const dto = {
      id: 1,
      category: 'service',
      rating: 5,
      status: 'new',
      createdAt: '2026-10-16T10:00:00Z',
      ...cipher,
    }
    expect(complaintSchema.safeParse(dto).success).toBe(true)
    expect(
      complaintSchema.safeParse({
        ...dto,
        envelopes: [{ deviceId: 1, ephemeralPublicKey: 'AA==', nonce: 'AA==', wrappedKey: 'AA==' }],
      }).success,
    ).toBe(true)
    expect(complaintSchema.safeParse({ ...dto, rating: 6 }).success).toBe(false)
    expect(complaintSchema.safeParse({ ...dto, rating: 0 }).success).toBe(false)
    expect(complaintSchema.safeParse({ ...dto, rating: 2.5 }).success).toBe(false)
    expect(complaintSchema.safeParse({ ...dto, status: 'done' }).success).toBe(false)
    expect(complaintSchema.safeParse({ ...dto, userId: 9 }).success).toBe(false)

    const submit = { category: 'service', rating: 3, ...cipher }
    expect(complaintSubmitSchema.safeParse(submit).success).toBe(true)
    expect(complaintSubmitSchema.safeParse({ ...submit, ciphertext: '' }).success).toBe(false)
    expect(complaintSubmitSchema.safeParse({ ...submit, status: 'new' }).success).toBe(false)
  })

  it('validates keys', () => {
    const key = { deviceId: 3, userId: 2, publicKey: 'AA', createdAt: '2026-10-16T10:00:00Z' }
    expect(deviceKeySchema.safeParse(key).success).toBe(true)
    expect(deviceKeySchema.safeParse({ ...key, publicKey: '' }).success).toBe(false)
    expect(deviceKeyRegisterSchema.safeParse({ publicKey: 'AA', label: 'Телефон' }).success).toBe(
      true,
    )
    expect(deviceKeyRegisterSchema.safeParse({ publicKey: 'AA', deviceId: 1 }).success).toBe(false)
    const env = { deviceId: 1, ephemeralPublicKey: 'AA', nonce: 'AA', wrappedKey: 'AA' }
    expect(
      secretSendSchema.safeParse({
        kind: 'secret',
        ciphertext: 'AA',
        nonce: 'AA',
        envelopes: [env],
      }).success,
    ).toBe(true)
    expect(
      secretSendSchema.safeParse({ kind: 'secret', ciphertext: 'AA', nonce: 'AA', envelopes: [] })
        .success,
    ).toBe(false)
    expect(
      envelopesMismatchSchema.safeParse({
        message: 'x',
        code: 'envelopes_mismatch',
        missingDeviceIds: [2],
        unexpectedDeviceIds: [],
      }).success,
    ).toBe(true)
    const msg = {
      id: 1,
      conversationId: 1,
      senderId: 1,
      createdAt: 't',
      kind: 'secret',
      body: null,
    }
    expect(chatMessageSchema.safeParse({ ...msg, redacted: true }).success).toBe(true)
    expect(chatMessageSchema.safeParse(msg).success).toBe(false)
    expect(
      chatMessageSchema.safeParse({ ...msg, ciphertext: 'AA', nonce: 'AA', envelopes: [env] })
        .success,
    ).toBe(true)
    expect(
      ownerPublicKeySchema.safeParse({ ownerKeyId: 1, publicKey: 'AA==', fingerprint: 'ab' })
        .success,
    ).toBe(true)
    expect(ownerPublicKeySchema.safeParse({ ownerKeyId: 1, publicKey: 'AA==' }).success).toBe(false)
  })
})
