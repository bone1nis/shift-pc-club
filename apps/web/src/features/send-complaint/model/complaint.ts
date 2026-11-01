import { complaintSubmitSchema, ownerPublicKeySchema } from '@shift/contracts'
import { fingerprintOfKey, importPublicKey, sealToRecipient } from '@shift/e2ee'
import { api, ApiFailure, apiParsed } from '@fsd/shared/api'

export const complaintCategories = [
  { value: 'staff', label: 'Персонал' },
  { value: 'equipment', label: 'Оборудование' },
  { value: 'service', label: 'Обслуживание' },
  { value: 'booking', label: 'Бронирование' },
  { value: 'review', label: 'Отзыв о клубе' },
  { value: 'other', label: 'Другое' },
]

export const FINGERPRINT_STORAGE_KEY = 'shift.owner-key-fingerprint'
export const MAX_TEXT = 5000

const ownerKeyResponse = ownerPublicKeySchema.pick({ ownerKeyId: true, publicKey: true })

export interface OwnerKeyInfo {
  ownerKeyId: number
  publicKey: string
  fingerprint: string
}

/** Ключ владельца недоступен (404): жалобы пока принимать некому. */
export class OwnerKeyMissing extends Error {}

export async function loadOwnerKey(): Promise<OwnerKeyInfo> {
  try {
    const key = await apiParsed(ownerKeyResponse, '/api/club/owner-key')
    return { ...key, fingerprint: await fingerprintOfKey(await importPublicKey(key.publicKey)) }
  } catch (e) {
    if (e instanceof ApiFailure && e.status === 404) throw new OwnerKeyMissing()
    throw e
  }
}

export function readSeenFingerprint(): string | null {
  try {
    return localStorage.getItem(FINGERPRINT_STORAGE_KEY)
  } catch {
    return null
  }
}

export function rememberFingerprint(value: string): void {
  try {
    localStorage.setItem(FINGERPRINT_STORAGE_KEY, value)
  } catch {
    /* хранилище недоступно — предупреждение просто не сработает */
  }
}

export interface ComplaintInput {
  category: string
  rating: number
  text: string
  bookingId?: number | null
  showName?: boolean
  name?: string
}

/** Открытый текст, привязка к брони и имя уходят только внутри шифртекста. */
export async function submitComplaint(input: ComplaintInput, key: OwnerKeyInfo): Promise<void> {
  const payload = {
    v: 1,
    text: input.text.trim(),
    ...(input.bookingId ? { bookingId: input.bookingId } : {}),
    showName: Boolean(input.showName),
    ...(input.showName && input.name ? { name: input.name } : {}),
  }
  const sealed = await sealToRecipient(JSON.stringify(payload), key.publicKey, {
    ownerKeyId: key.ownerKeyId,
  })
  const body = complaintSubmitSchema.parse({
    category: input.category,
    rating: input.rating,
    ownerKeyId: key.ownerKeyId,
    ephemeralPublicKey: sealed.ephemeralPublicKey,
    nonce: sealed.nonce,
    ciphertext: sealed.ciphertext,
  })
  await api<unknown>('/api/club/complaints', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function complaintErrorMessage(error: unknown): string {
  if (error instanceof OwnerKeyMissing) return 'Владелец ещё не настроил приём жалоб.'
  if (error instanceof ApiFailure) {
    if (error.status === 429)
      return 'Лимит исчерпан: не больше 5 обращений в сутки. Попробуйте завтра.'
    if (error.status === 422)
      return 'Сервер не принял обращение. Проверьте категорию, оценку и текст.'
    if (error.status === 404) return 'Владелец ещё не настроил приём жалоб.'
    return error.message
  }
  return 'Нет соединения с сервером. Проверьте сеть и попробуйте ещё раз.'
}
