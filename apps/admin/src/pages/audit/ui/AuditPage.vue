<script setup lang="ts">
import { UiButton, UiEmpty, UiPanel, UiTable } from '@shift/ui'
import { dateTime } from '@fsd/shared/format'
import { useAudit } from '../model/useAudit'

const audit = useAudit()

/** Короткая запись изменений: при многих полях показываем только их названия, полный текст — во всплывающей подсказке. */
function summary(changes: string): string {
  try {
    const value = JSON.parse(changes) as unknown
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value)
      if (keys.length > 3) return `Изменены поля (${keys.length}): ${keys.join(', ')}`
    }
  } catch {
    // Не JSON — показываем как есть.
  }
  return changes
}
</script>

<template>
  <UiPanel eyebrow="Кто, что и когда изменил" title="Последние действия">
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="audit.load">Обновить</UiButton>
    </template>
    <UiTable label="История действий">
      <thead>
        <tr>
          <th>Когда</th>
          <th>Администратор</th>
          <th>Действие</th>
          <th>Объект</th>
          <th>Изменения</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in audit.entries.value" :key="`${entry.entity}-${entry.id}`">
          <td>{{ dateTime(entry.created_at) }}</td>
          <td>#{{ entry.actor_id }}</td>
          <td>{{ entry.action }}</td>
          <td>{{ entry.entity }} #{{ entry.entity_id }}</td>
          <td class="audit__changes" :title="entry.changes">{{ summary(entry.changes) }}</td>
        </tr>
      </tbody>
    </UiTable>
    <UiEmpty v-if="!audit.entries.value.length">Записей пока нет.</UiEmpty>
  </UiPanel>
</template>

<style scoped>
.audit__changes {
  white-space: normal;
  min-width: 240px;
  max-width: 448px;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--fs-12);
  color: var(--muted);
}
</style>
