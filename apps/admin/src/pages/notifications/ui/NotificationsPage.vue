<script setup lang="ts">
import { vAutoAnimate } from '@formkit/auto-animate/vue'
import { UiButton, UiEmpty, UiPanel, UiStatus, UiTable } from '@shift/ui'
import { useOperationsStore } from '@fsd/entities/operations'
import { dateTime } from '@fsd/shared/format'
import { useNotifications, type NotificationDelivery } from '../model/useNotifications'

const ops = useOperationsStore()
const notifications = useNotifications()
const labels: Record<NotificationDelivery['delivery_status'], string> = {
  pending: 'Ожидает',
  sent: 'Отправлено',
  failed: 'Ошибка',
  skipped: 'Пропущено',
}
const tones = { pending: 'neutral', sent: 'success', failed: 'danger', skipped: 'warning' } as const
</script>

<template>
  <UiPanel eyebrow="Письма игрокам" title="Состояние отправки">
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="notifications.load">Обновить</UiButton>
    </template>
    <UiTable label="Уведомления">
      <thead>
        <tr>
          <th>Когда</th>
          <th>Игрок</th>
          <th>Событие</th>
          <th>Статус</th>
          <th>Попытки</th>
          <th><span class="sr-only">Действие</span></th>
        </tr>
      </thead>
      <tbody v-auto-animate>
        <tr v-for="item in notifications.items.value" :key="item.id">
          <td>{{ dateTime(item.created_at) }}</td>
          <td>#{{ item.user_id }}</td>
          <td>{{ item.type }}</td>
          <td>
            <UiStatus :tone="tones[item.delivery_status]">{{
              labels[item.delivery_status]
            }}</UiStatus>
          </td>
          <td>{{ item.delivery_attempts }}</td>
          <td>
            <UiButton
              v-if="item.delivery_status === 'failed'"
              variant="secondary"
              size="sm"
              :disabled="ops.pending"
              @click="notifications.retry(item)"
              >Повторить</UiButton
            >
          </td>
        </tr>
      </tbody>
    </UiTable>
    <UiEmpty v-if="!notifications.items.value.length">Уведомлений пока нет.</UiEmpty>
  </UiPanel>
</template>
