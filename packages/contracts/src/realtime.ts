import { z } from 'zod'

/**
 * Контракт realtime (этап 8): имена каналов, события-сигналы, чат, жалобы и ключи.
 * Типы выводятся из схем (`z.infer`), отдельных интерфейсов нет.
 */
const id = z.number().int().positive()
const base64 = z.string().min(1)
const isoDate = z.string().min(1)

// Каналы
export const userChannel = (userId: number) => `private-user.${userId}`
export const hallChannel = 'private-hall'
export const bookingChatChannel = (bookingId: number) => `private-booking.${bookingId}.chat`
export const bookingChatPresenceChannel = (bookingId: number) =>
  `presence-booking.${bookingId}.chat`
export const ownerChannel = 'private-owner'

// События-сигналы: в теле только тип и id сущности
export const realtimeEventNames = ['account.changed', 'hall.changed', 'complaint.created'] as const
export const realtimeEventNameSchema = z.enum(realtimeEventNames)
export type RealtimeEventName = z.infer<typeof realtimeEventNameSchema>

const signal = <T extends string>(name: T) =>
  z.strictObject({ type: z.string().min(1), id: id }).describe(name)

export const accountChangedSchema = signal('account.changed')
export const hallChangedSchema = signal('hall.changed')
export const complaintCreatedSchema = signal('complaint.created')
export type SignalPayload = z.infer<typeof accountChangedSchema>

// Чат
export const envelopeSchema = z.strictObject({
  deviceId: id,
  ephemeralPublicKey: base64,
  nonce: base64,
  wrappedKey: base64,
})
export type Envelope = z.infer<typeof envelopeSchema>

// Клиентское событие «печатает…» в presence-канале (whisper). Reverb принимает его только
// от участников канала; клиент шлёт не чаще раза в 2-3 секунды.
export const typingEventName = 'client-typing'
export const typingSchema = z.strictObject({ userId: id })
export type Typing = z.infer<typeof typingSchema>

// Позиция прочтения: событие `message.read` в private-канале чата и ответ POST .../read
export const messageReadSchema = z.strictObject({ userId: id, upToMessageId: id })
export type MessageRead = z.infer<typeof messageReadSchema>
export const readRequestSchema = z.strictObject({ upToMessageId: id })
export type ReadRequest = z.infer<typeof readRequestSchema>

// Вложение чата (картинка до 10 МБ); файл отдаёт GET `url` только участникам и модераторам
export const attachmentMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export const attachmentMaxBytes = 10 * 1024 * 1024
export const chatAttachmentSchema = z.strictObject({
  id,
  name: z.string().min(1),
  mime: z.enum(attachmentMimeTypes),
  size: z.number().int().positive().max(attachmentMaxBytes),
  url: z.string().min(1),
})
export type ChatAttachment = z.infer<typeof chatAttachmentSchema>

const chatMessageBase = {
  id,
  conversationId: id,
  senderId: id,
  createdAt: isoDate,
}
export const chatMessageSchema = z.discriminatedUnion('kind', [
  z
    .strictObject({
      ...chatMessageBase,
      kind: z.literal('text'),
      // У сообщения с вложением подпись необязательна (null); без вложения текст обязателен
      body: z.string().min(1).max(2000).nullable().optional(),
      attachment: chatAttachmentSchema.nullable().optional(),
    })
    .refine((m) => (m.body != null && m.body !== '') || m.attachment != null, {
      message: 'Text message needs a body or an attachment',
    }),
  z
    .strictObject({
      ...chatMessageBase,
      kind: z.literal('secret'),
      // Открытого текста у секрета нет: body всегда null
      body: z.null().optional(),
      // Модератору шифртекст не отдаётся: redacted=true вместо ciphertext/nonce/envelopes
      redacted: z.literal(true).optional(),
      ciphertext: base64.optional(),
      nonce: base64.optional(),
      envelopes: z.array(envelopeSchema).min(1).optional(),
    })
    .refine(
      (m) =>
        m.redacted === true ||
        (m.ciphertext !== undefined && m.nonce !== undefined && m.envelopes !== undefined),
      { message: 'Secret message needs ciphertext, nonce and envelopes unless redacted' },
    ),
])
export type ChatMessage = z.infer<typeof chatMessageSchema>

export const messageSentSchema = chatMessageSchema
export type MessageSent = ChatMessage

// Жалобы
export const complaintStatusSchema = z.enum(['new', 'read', 'closed'])
export type ComplaintStatus = z.infer<typeof complaintStatusSchema>

const complaintCipher = {
  category: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  ownerKeyId: id,
  ephemeralPublicKey: base64,
  nonce: base64,
  ciphertext: base64,
  envelopes: z.array(envelopeSchema).optional(),
}
export const complaintSchema = z.strictObject({
  id,
  ...complaintCipher,
  status: complaintStatusSchema,
  createdAt: isoDate,
})
export type Complaint = z.infer<typeof complaintSchema>

export const complaintSubmitSchema = z.strictObject(complaintCipher)
export type ComplaintSubmit = z.infer<typeof complaintSubmitSchema>

// Ключи
// Публичный ключ устройства: base64url, 65 байт (несжатая точка P-256). deviceId = id в
// конвертах секретных сообщений. Отпечаток клиент считает сам из publicKey.
export const deviceKeySchema = z.strictObject({
  deviceId: id,
  userId: id,
  publicKey: base64,
  createdAt: isoDate,
})
export type DeviceKey = z.infer<typeof deviceKeySchema>

// POST /api/realtime/devices
export const deviceKeyRegisterSchema = z.strictObject({
  publicKey: base64,
  label: z.string().max(80).optional(),
})
export type DeviceKeyRegister = z.infer<typeof deviceKeyRegisterSchema>

// POST .../messages с kind=secret (вместо body)
export const secretSendSchema = z.strictObject({
  kind: z.literal('secret'),
  ciphertext: base64,
  nonce: base64,
  envelopes: z.array(envelopeSchema).min(1).max(50),
})
export type SecretSend = z.infer<typeof secretSendSchema>

// 422 при несовпадении набора конвертов: клиент перезапрашивает GET .../keys и шлёт заново
export const envelopesMismatchSchema = z.strictObject({
  message: z.string(),
  code: z.literal('envelopes_mismatch'),
  missingDeviceIds: z.array(id),
  unexpectedDeviceIds: z.array(id),
})
export type EnvelopesMismatch = z.infer<typeof envelopesMismatchSchema>

export const ownerPublicKeySchema = z.strictObject({
  ownerKeyId: id,
  publicKey: base64,
  fingerprint: z.string().min(1),
})
export type OwnerPublicKey = z.infer<typeof ownerPublicKeySchema>
