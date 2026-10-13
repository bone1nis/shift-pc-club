<script setup lang="ts">
import { computed, ref } from 'vue'
import { UiEmpty, UiField, UiPanel, UiStatus, UiTable } from '@shift/ui'
import { bookingLabel, statusTone, useOperationsStore } from '@fsd/entities/operations'
import { CheckInButton } from '@fsd/features/check-in-booking'
import { GuestSessionForm } from '@fsd/features/guest-session'
import { dateTime, money } from '@fsd/shared/format'

const ops = useOperationsStore()
const query = ref('')
const visible = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('ru-RU')
  return ops.bookings.filter(
    (b) => !needle || String(b.id).includes(needle) || String(b.user_id).includes(needle),
  )
})
</script>

<template>
  <GuestSessionForm />
  <UiPanel eyebrow="Посещения" title="Бронирования">
    <template #actions>
      <div class="schedule__search">
        <UiField
          v-model="query"
          type="search"
          hide-label
          label="Поиск по брони или ID посетителя"
          placeholder="Бронь или ID посетителя"
        />
      </div>
    </template>
    <UiTable label="Бронирования">
      <thead>
        <tr>
          <th>Бронь</th>
          <th>Посетитель</th>
          <th>Время</th>
          <th>Места</th>
          <th>Стоимость</th>
          <th>Статус</th>
          <th>Действие</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="booking in visible" :key="booking.id">
          <td>#{{ booking.id }}</td>
          <td>#{{ booking.user_id }}</td>
          <td>{{ dateTime(booking.starts_at) }} — {{ dateTime(booking.ends_at) }}</td>
          <td>{{ booking.items.map((item) => item.workstation_id).join(', ') }}</td>
          <td>{{ money(booking.total_price) }}</td>
          <td>
            <UiStatus :tone="statusTone(booking.status)">{{
              bookingLabel[booking.status] || booking.status
            }}</UiStatus>
          </td>
          <td><CheckInButton v-if="booking.status === 'confirmed'" :booking="booking" /></td>
        </tr>
      </tbody>
    </UiTable>
    <UiEmpty v-if="!visible.length">Подходящих броней нет.</UiEmpty>
  </UiPanel>
</template>

<style scoped>
.schedule__search {
  width: min(100%, 320px);
}
</style>
