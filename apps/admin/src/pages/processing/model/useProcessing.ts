import { onMounted, ref, watch } from 'vue'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'

export interface ProcessingOverview {
  outbox_pending: number
  outbox_oldest_age_seconds: number
  queues: Array<{ queue: string; waiting: number }>
  failed_jobs: number
  recent_failed_jobs: Array<{ id: number; queue: string; failed_at: string }>
  failed_notifications: number
  failed_exports: number
}

export function useProcessing() {
  const ops = useOperationsStore()
  const overview = ref<ProcessingOverview | null>(null)
  async function load() {
    try {
      overview.value = await api<ProcessingOverview>('/api/booking/admin/processing')
    } catch (cause) {
      ops.fail(cause)
    }
  }
  onMounted(load)
  watch(
    () => ops.tick,
    () => {
      void load()
    },
  )
  return { overview, load }
}
