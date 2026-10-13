<script setup lang="ts">
import { UiButton, UiEmpty, UiField, UiPanel } from '@shift/ui'
import { bookingLabel, sessionLabel, useOperationsStore } from '@fsd/entities/operations'
import { ManualBookingForm } from '@fsd/features/manual-booking'
import { dateTime, money } from '@fsd/shared/format'
import { useUserDirectory } from '../model/useUserDirectory'

const ops = useOperationsStore()
const directory = useUserDirectory()
const { users, selected, history } = directory
</script>

<template>
  <UiPanel title="Посетители">
    <form novalidate class="users__search" @submit.prevent="directory.search">
      <UiField
        v-model="directory.query.value"
        type="search"
        label="Имя или email посетителя"
        :maxlength="100"
      />
      <UiButton type="submit">Найти посетителя</UiButton>
    </form>
    <UiEmpty v-if="!users.length">Посетители не найдены.</UiEmpty>
    <ul v-else class="users__list">
      <li v-for="user in users" :key="user.id">
        <span>#{{ user.id }} · {{ user.name }} · {{ user.email }}</span>
        <UiButton variant="secondary" size="sm" @click="directory.showHistory(user)"
          >История #{{ user.id }}</UiButton
        >
      </li>
    </ul>
  </UiPanel>
  <UiPanel v-if="selected" :title="`История: ${selected.name}`">
    <ManualBookingForm :user="selected" @created="directory.showHistory(selected)" />
    <p v-if="!history && !ops.error" role="status" class="users__muted">Загружаем историю…</p>
    <template v-if="history">
      <h3>Бронирования</h3>
      <p v-if="!history.bookings.length" class="users__muted">Бронирований нет.</p>
      <ul class="users__log">
        <li v-for="booking in history.bookings" :key="booking.id">
          Бронь #{{ booking.id }} · {{ dateTime(booking.starts_at) }} ·
          {{ bookingLabel[booking.status] }} · {{ money(booking.total_price) }}
        </li>
      </ul>
      <h3>Посещения</h3>
      <p v-if="!history.sessions.length" class="users__muted">Посещений нет.</p>
      <ul class="users__log">
        <li v-for="session in history.sessions" :key="session.id">
          Сессия #{{ session.id }} · PC #{{ session.workstation_id }} ·
          {{ dateTime(session.starts_at) }} · {{ sessionLabel[session.status] }} ·
          {{ money(session.total_price) }}
        </li>
      </ul>
    </template>
  </UiPanel>
</template>

<style scoped>
.users__search {
  display: flex;
  align-items: end;
  gap: 16px;
  flex-wrap: wrap;
}
.users__search > :first-child {
  flex: 1 1 288px;
}
.users__list,
.users__log {
  margin: 0;
  padding: 0;
  list-style: none;
}
.users__list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 11px 0;
  border-top: 1px solid var(--line);
  font-size: var(--fs-14);
}
.users__log li {
  padding: 8px 0;
  border-top: 1px solid var(--line);
  font-size: var(--fs-14);
}
.users__muted {
  font-size: var(--fs-14);
  color: var(--muted);
}
h3 {
  font-size: var(--fs-16);
}
</style>
