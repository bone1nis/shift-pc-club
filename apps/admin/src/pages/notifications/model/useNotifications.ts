import { onMounted, ref, watch } from 'vue'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'

export interface NotificationDelivery {
  id: number
  user_id: number
  type: string
  delivery_status: 'pending' | 'sent' | 'failed' | 'skipped'
  delivery_attempts: number
  delivery_error: string | null
  created_at: string
}

export function useNotifications() {
  const ops = useOperationsStore()
  const items = ref<NotificationDelivery[]>([])
  async function load() {
    try {
      items.value = await api<NotificationDelivery[]>('/api/booking/admin/notifications')
    } catch (cause) {
      ops.fail(cause)
    }
  }
  const retry = (item: NotificationDelivery) =>
    ops.run(
      () => api(`/api/booking/admin/notifications/${item.id}/retry`, { method: 'POST' }),
      'Повторная отправка поставлена в очередь. Бронь не изменилась.',
    )
  onMounted(load)
  watch(
    () => ops.tick,
    () => {
      void load()
    },
  )
  return { items, load, retry }
}
