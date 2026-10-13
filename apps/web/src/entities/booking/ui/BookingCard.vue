<script setup lang="ts">
import { computed } from 'vue'
import { UiPanel, UiStatus } from '@shift/ui'
import type { Booking } from '@shift/contracts'
import { dateTime, money } from '@fsd/shared/format'

const props = defineProps<{ booking: Booking }>()
const labels: Record<string, string> = {
  confirmed: 'Подтверждена',
  cancelled: 'Отменена',
  checked_in: 'В клубе',
  no_show: 'Неявка',
}
const tone = computed(() =>
  props.booking.status === 'confirmed'
    ? ('success' as const)
    : props.booking.status === 'cancelled'
      ? ('neutral' as const)
      : ('warning' as const),
)
</script>

<template>
  <UiPanel class="booking-card">
    <div class="booking-card__row">
      <span class="booking-card__id">Бронь #{{ booking.id }}</span
      ><UiStatus :tone="tone">{{ labels[booking.status] || booking.status }}</UiStatus>
    </div>
    <div class="booking-card__row">
      <div>
        <p>{{ dateTime(booking.starts_at) }} → {{ dateTime(booking.ends_at) }}</p>
        <p class="booking-card__seats">
          Места: {{ booking.items.map((item) => `PC #${item.workstation_id}`).join(', ') }}
        </p>
      </div>
      <b>{{ money(booking.total_price) }}</b>
    </div>
    <div v-if="$slots.actions" class="booking-card__actions"><slot name="actions" /></div>
  </UiPanel>
</template>

<style scoped>
.booking-card__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}
.booking-card__id {
  font-family: var(--font-display);
  font-size: var(--fs-28);
}
.booking-card__seats {
  font-size: var(--fs-13);
  color: var(--muted);
}
.booking-card__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}
@media (max-width: 700px) {
  .booking-card__row {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
