import { onMounted, ref } from 'vue'
import { navigateTo } from '#imports'
import { useUserStore } from '@fsd/entities/user'
import { api } from '@fsd/shared/api'
import { inviteError } from '@fsd/features/booking-chat'

/** Принимает приглашение: гостя отправляет на вход, после принятия ведёт в кабинет с открытым чатом. */
export function useInviteAccept(token: string) {
  const user = useUserStore()
  const error = ref('')
  const pending = ref(true)

  async function run() {
    pending.value = true
    error.value = ''
    if (!user.loaded) await user.load()
    if (!user.user) {
      await navigateTo(`/auth?next=${encodeURIComponent(`/invite/${token}`)}`)
      return
    }
    try {
      const data = await api<{ bookingId: number }>(
        `/api/realtime/invitations/${encodeURIComponent(token)}/accept`,
        { method: 'POST' },
      )
      await navigateTo(`/account?chat=${data.bookingId}`)
    } catch (e) {
      error.value = inviteError(e)
      pending.value = false
    }
  }
  onMounted(run)
  return { error, pending, retry: run }
}
