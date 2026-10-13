<script setup lang="ts">
import { UiTable } from '@shift/ui'
import type { GamingSession } from '@shift/contracts'
import { dateTime, money } from '@fsd/shared/format'

defineProps<{ sessions: GamingSession[] }>()
</script>

<template>
  <UiTable label="История посещений">
    <thead>
      <tr>
        <th>Место</th>
        <th>Начало</th>
        <th>Завершение</th>
        <th>Стоимость</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="session in sessions" :key="session.id">
        <td>PC #{{ session.workstation_id }}</td>
        <td>{{ dateTime(session.starts_at) }}</td>
        <td>{{ dateTime(session.ended_at || session.ends_at) }}</td>
        <td>{{ money(session.total_price) }}</td>
      </tr>
    </tbody>
  </UiTable>
</template>
