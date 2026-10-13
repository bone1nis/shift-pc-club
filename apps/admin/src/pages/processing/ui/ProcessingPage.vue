<script setup lang="ts">
import { UiButton, UiEmpty, UiPanel, UiStatCard, UiTable } from '@shift/ui'
import { dateTime } from '@fsd/shared/format'
import { StatGrid } from '@fsd/shared/ui'
import { useProcessing } from '../model/useProcessing'

const processing = useProcessing()
const { overview } = processing
</script>

<template>
  <UiPanel eyebrow="Фоновые задачи и события" title="Состояние обработки">
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="processing.load">Обновить</UiButton>
    </template>
    <template v-if="overview">
      <StatGrid>
        <UiStatCard
          label="События в очереди публикации"
          :value="overview.outbox_pending"
          :hint="`самому старому ${overview.outbox_oldest_age_seconds} с`"
        />
        <UiStatCard
          label="Ошибки задач"
          :value="overview.failed_jobs"
          hint="всего в журнале сбоев"
        />
        <UiStatCard
          label="Письма с ошибкой"
          :value="overview.failed_notifications"
          hint="повтор — в разделе «Уведомления»"
        />
        <UiStatCard
          label="Выгрузки с ошибкой"
          :value="overview.failed_exports"
          hint="закажите выгрузку заново"
        />
      </StatGrid>
      <UiTable label="Очереди">
        <thead>
          <tr>
            <th>Очередь</th>
            <th>Ожидает</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in overview.queues" :key="item.queue">
            <td>{{ item.queue }}</td>
            <td>{{ item.waiting }}</td>
          </tr>
        </tbody>
      </UiTable>
      <UiEmpty v-if="!overview.queues.length">Очереди пусты.</UiEmpty>
      <UiTable v-if="overview.recent_failed_jobs.length" label="Последние сбои задач">
        <thead>
          <tr>
            <th>Когда</th>
            <th>Очередь</th>
            <th>Задача</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="job in overview.recent_failed_jobs" :key="job.id">
            <td>{{ dateTime(job.failed_at) }}</td>
            <td>{{ job.queue }}</td>
            <td>#{{ job.id }}</td>
          </tr>
        </tbody>
      </UiTable>
    </template>
  </UiPanel>
</template>
