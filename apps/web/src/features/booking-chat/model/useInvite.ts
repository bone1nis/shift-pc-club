import { ref } from 'vue'
import { api, ApiFailure, errorMessage } from '@fsd/shared/api'

/** Текст ошибки приглашения по-русски. */
export function inviteError(error: unknown): string {
  if (error instanceof ApiFailure) {
    if (error.status === 404) return 'Приглашение не найдено. Проверьте ссылку.'
    if (error.status === 410)
      return 'Приглашение недействительно: срок истёк или ссылку уже использовали.'
    if (error.status === 409)
      return 'Не получится войти в чат: он закрыт или вы уже в нём участвуете.'
    if (error.status === 403) return 'Только владелец брони может приглашать друзей.'
  }
  return errorMessage(error)
}

export function useInviteLink(bookingId: number) {
  const url = ref('')
  const pending = ref(false)
  const error = ref('')
  const copied = ref(false)
  async function create() {
    if (pending.value) return
    pending.value = true
    error.value = ''
    copied.value = false
    try {
      const data = await api<{ url: string; token: string }>(
        `/api/realtime/bookings/${bookingId}/invitations`,
        { method: 'POST' },
      )
      url.value = data.url || `${window.location.origin}/invite/${data.token}`
      try {
        await navigator.clipboard.writeText(url.value)
        copied.value = true
      } catch {
        /* буфер недоступен: ссылка остаётся в поле для ручного копирования */
      }
    } catch (e) {
      error.value = inviteError(e)
    } finally {
      pending.value = false
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url.value)
      copied.value = true
    } catch {
      error.value = 'Не удалось скопировать. Выделите ссылку и скопируйте вручную.'
    }
  }
  return { url, pending, error, copied, create, copy }
}
