<script setup lang="ts">
import { UiButton } from '@shift/ui'
import type { Booking } from '@shift/contracts'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'

const props = defineProps<{ booking: Booking }>()
const ops = useOperationsStore()

function checkIn() {
  return ops.run(
    () => api(`/api/booking/admin/bookings/${props.booking.id}/check-in`, { method: 'POST' }),
    `Бронь №${props.booking.id} заселена.`,
  )
}
</script>

<template>
  <UiButton variant="secondary" size="sm" :disabled="ops.pending" @click="checkIn"
    >Заселить</UiButton
  >
</template>
