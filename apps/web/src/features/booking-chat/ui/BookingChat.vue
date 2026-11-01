<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { UiButton } from '@shift/ui'
import { useChatUnread } from '../model/useChatUnread'
import ChatPanel from './ChatPanel.vue'

const props = defineProps<{ bookingId: number; initialOpen?: boolean }>()
const open = ref(!!props.initialOpen)
const panelId = `booking-chat-${props.bookingId}`
const { unreadCount } = useChatUnread(props.bookingId, open)
const toggle = ref<InstanceType<typeof UiButton> | null>(null)

async function close() {
  open.value = false
  await nextTick()
  ;(toggle.value?.$el as HTMLElement | undefined)?.focus()
}
</script>

<template>
  <UiButton
    ref="toggle"
    variant="secondary"
    :aria-expanded="open"
    :aria-controls="panelId"
    @click="open ? close() : (open = true)"
  >
    {{ open ? 'Скрыть чат' : 'Чат' }}
    <span v-if="!open && unreadCount > 0" class="booking-chat__badge" aria-hidden="true">{{
      unreadCount
    }}</span>
    <span v-if="!open && unreadCount > 0" class="sr-only">, непрочитанных: {{ unreadCount }}</span>
  </UiButton>
  <div :id="panelId" class="booking-chat">
    <ChatPanel v-if="open" :booking-id="bookingId" :autofocus="!initialOpen" @close="close" />
  </div>
</template>

<style scoped>
.booking-chat__badge {
  display: inline-block;
  min-width: 1.5em;
  margin-left: 6px;
  padding: 0 6px;
  background: var(--acid);
  color: var(--acid-ink);
  border-radius: 999px;
  font-size: var(--fs-14);
  text-align: center;
}
.booking-chat {
  flex: 1 0 100%;
}
.booking-chat:empty {
  display: none;
}
</style>
