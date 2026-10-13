import { onMounted, ref, watch } from 'vue'
import type { Booking, GamingSession, User } from '@shift/contracts'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'

export function useUserDirectory() {
  const ops = useOperationsStore()
  const query = ref('')
  const users = ref<User[]>([])
  const selected = ref<User | null>(null)
  const history = ref<{ bookings: Booking[]; sessions: GamingSession[] } | null>(null)
  let sequence = 0

  async function search() {
    try {
      const result = await api<{ users: User[] }>(
        '/api/auth/admin/users?' + new URLSearchParams({ query: query.value }),
      )
      users.value = result.users
    } catch (cause) {
      ops.fail(cause)
    }
  }
  async function showHistory(user: User) {
    const current = ++sequence
    // История того же посетителя обновляется «тихо»: пока грузится новая, остаётся прежняя, иначе страница прыгает.
    if (selected.value?.id !== user.id) history.value = null
    selected.value = user
    try {
      const loaded = await api<{ bookings: Booking[]; sessions: GamingSession[] }>(
        `/api/booking/admin/users/${user.id}/history`,
      )
      if (current === sequence) history.value = loaded
    } catch (cause) {
      if (current === sequence) ops.fail(cause)
    }
  }

  onMounted(search)
  watch(
    () => ops.tick,
    () => {
      void search()
    },
  )
  return { query, users, selected, history, search, showHistory }
}
