<script setup lang="ts">
import { computed, ref } from 'vue'
import { UiButton, UiEmpty, UiPanel, UiSkeleton } from '@shift/ui'
import type { Notification } from '@shift/contracts'
import { dateTime } from '@fsd/shared/format'
import { notificationText } from '../lib/text'

const VISIBLE = 5
const props = defineProps<{ items: Notification[]; loading?: boolean }>()
const expanded = ref(false)
const shown = computed(() => (expanded.value ? props.items : props.items.slice(0, VISIBLE)))
</script>

<template>
  <UiPanel>
    <UiEmpty v-if="loading" role="status">
      <span class="sr-only">Загружаем уведомления…</span>
      <UiSkeleton class="notifications__skeleton" shape="text" width="60%" height="26px" />
    </UiEmpty>
    <UiEmpty v-else-if="!items.length">
      Уведомления о бронях и играх появятся здесь. Копии приходят на email.
    </UiEmpty>
    <template v-else>
      <ul class="notifications" aria-label="Уведомления">
        <li v-for="item in shown" :key="item.id" class="notifications__item">
          <span class="notifications__text">{{ notificationText(item) }}</span>
          <time class="notifications__time" :datetime="item.created_at">{{
            dateTime(item.created_at)
          }}</time>
        </li>
      </ul>
      <UiButton
        v-if="items.length > VISIBLE"
        variant="ghost"
        size="sm"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Свернуть' : `Показать все (${items.length})` }}
      </UiButton>
    </template>
  </UiPanel>
</template>

<style scoped>
.notifications__skeleton {
  display: block;
  margin: 0 auto;
}
.notifications {
  display: grid;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}
.notifications__item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
}
.notifications__item:first-child {
  border-top: 0;
  padding-top: 0;
}
.notifications__text {
  font-size: var(--fs-14);
}
.notifications__time {
  flex: none;
  font-size: var(--fs-12);
  color: var(--muted);
}
@media (max-width: 520px) {
  .notifications__item {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
