import { onMounted, ref, watch } from 'vue'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'

export interface AuditEntry {
  id: number
  actor_id: number
  action: string
  entity: string
  entity_id: number
  changes: string
  created_at: string
}

export function useAudit() {
  const ops = useOperationsStore()
  const entries = ref<AuditEntry[]>([])
  async function load() {
    try {
      const [booking, club] = await Promise.all([
        api<AuditEntry[]>('/api/booking/admin/audit'),
        api<AuditEntry[]>('/api/club/admin/audit'),
      ])
      entries.value = [...booking, ...club]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)
        .slice(0, 100)
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
  return { entries, load }
}
