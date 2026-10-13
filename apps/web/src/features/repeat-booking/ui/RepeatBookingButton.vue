<script setup lang="ts">
import { ref } from 'vue'
import { navigateTo } from '#imports'
import { UiButton } from '@shift/ui'
import type { Booking, Catalog } from '@shift/contracts'
import { api, errorMessage } from '@fsd/shared/api'

const props = defineProps<{ booking: Booking }>()
const emit = defineEmits<{ failed: [message: string] }>()
const pending = ref(false)

async function repeat() {
  if (pending.value) return
  pending.value = true
  try {
    const catalog = await api<Catalog>('/api/club/catalog')
    const first = catalog.workstations.find((w) => w.id === props.booking.items[0]?.workstation_id)
    const ids = props.booking.items
      .filter(
        (item) =>
          catalog.workstations.find((w) => w.id === item.workstation_id)?.zone_id ===
          first?.zone_id,
      )
      .map((item) => item.workstation_id)
    const query = new URLSearchParams()
    if (first) query.set('zone', String(first.zone_id))
    if (ids.length) query.set('workstations', ids.join(','))
    await navigateTo(`/booking?${query.toString()}`)
  } catch (cause) {
    emit('failed', errorMessage(cause))
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <UiButton variant="secondary" :loading="pending" @click="repeat">Повторить места</UiButton>
</template>
