<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UiButton, UiCheckbox, UiDateTimePicker, UiNotice, UiNumberInput } from '@shift/ui'
import type { Booking, User } from '@shift/contracts'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'
import { clubDateTimeInput, clubDateTimeToIso } from '@fsd/shared/format'

const props = defineProps<{ user: User }>()
const emit = defineEmits<{ created: [] }>()
const ops = useOperationsStore()

const start = ref(clubDateTimeInput(new Date(Math.ceil((Date.now() + 60000) / 1800000) * 1800000)))
const hours = ref(1)
const seats = ref<number[]>([])
const problem = ref('')
let key = crypto.randomUUID()
watch([start, hours, seats, () => props.user.id], () => {
  key = crypto.randomUUID()
})

const minimum = computed(() => clubDateTimeInput(new Date()))
const zones = computed(() =>
  (ops.catalog?.zones ?? []).map((zone) => ({
    zone,
    seats: (ops.catalog?.workstations ?? []).filter((w) => w.zone_id === zone.id),
  })),
)
const toggle = (id: number, on: boolean) => {
  seats.value = on ? [...seats.value, id] : seats.value.filter((value) => value !== id)
}

async function create() {
  const startsAt = clubDateTimeToIso(start.value)
  if (!startsAt || !seats.value.length) {
    problem.value = 'Укажите время начала и выберите хотя бы один компьютер.'
    return
  }
  problem.value = ''
  const date = new Date(startsAt)
  const done = await ops.run(
    () =>
      api<Booking>('/api/booking/admin/bookings', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({
          user_id: props.user.id,
          workstation_ids: seats.value,
          starts_at: date.toISOString(),
          ends_at: new Date(date.getTime() + hours.value * 3600000).toISOString(),
        }),
      }),
    'Бронь посетителя создана. Она доступна в расписании.',
  )
  if (done) {
    key = crypto.randomUUID()
    seats.value = []
    emit('created')
  }
}
</script>

<template>
  <form novalidate class="manual" @submit.prevent="create">
    <h3>Создать бронь для посетителя</h3>
    <div class="manual__time">
      <UiDateTimePicker v-model="start" label="Начало брони, время клуба" :min="minimum" required />
      <UiNumberInput v-model="hours" label="Продолжительность, часов" :min="1" :max="12" required />
    </div>
    <fieldset class="manual__seats">
      <legend>Компьютеры</legend>
      <div v-for="group in zones" :key="group.zone.id" class="manual__zone">
        <span class="manual__zone-name">{{ group.zone.name }}</span>
        <div class="manual__grid">
          <UiCheckbox
            v-for="seat in group.seats"
            :key="seat.id"
            :model-value="seats.includes(seat.id)"
            :label="seat.name"
            :disabled="seat.status !== 'available'"
            @update:model-value="toggle(seat.id, $event)"
          />
        </div>
      </div>
    </fieldset>
    <UiNotice v-if="problem" tone="error">{{ problem }}</UiNotice>
    <UiButton type="submit" :loading="ops.pending">Создать бронь посетителю</UiButton>
  </form>
</template>

<style scoped>
.manual {
  display: grid;
  gap: 19px;
}
.manual h3 {
  font-size: var(--fs-16);
}
.manual__time {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.manual__seats {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 0;
  border: 0;
}
.manual__seats legend {
  margin-bottom: 10px;
  padding: 0;
  font-size: var(--fs-13);
  font-weight: 600;
}
.manual__zone {
  display: grid;
  gap: 10px;
}
.manual__zone-name {
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--muted);
}
.manual__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 12px;
}
@media (max-width: 760px) {
  .manual__time {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
