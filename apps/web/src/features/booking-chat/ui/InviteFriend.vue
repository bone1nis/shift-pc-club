<script setup lang="ts">
import { UiButton, UiNotice } from '@shift/ui'
import { useInviteLink } from '../model/useInvite'

const props = defineProps<{ bookingId: number }>()
const invite = useInviteLink(props.bookingId)
</script>

<template>
  <div class="invite">
    <UiButton size="sm" variant="ghost" :loading="invite.pending.value" @click="invite.create()">
      Пригласить друга
    </UiButton>
    <div v-if="invite.url.value" class="invite__link">
      <label class="sr-only" :for="`invite-url-${bookingId}`">Ссылка-приглашение</label>
      <input
        :id="`invite-url-${bookingId}`"
        class="invite__input"
        :value="invite.url.value"
        readonly
        @focus="($event.target as HTMLInputElement).select()"
      />
      <UiButton size="sm" variant="secondary" @click="invite.copy()">Копировать</UiButton>
      <p class="invite__hint" role="status">
        {{ invite.copied.value ? 'Ссылка скопирована. ' : '' }}Действует 72 часа, подходит одному
        человеку.
      </p>
    </div>
    <UiNotice v-if="invite.error.value" tone="error">{{ invite.error.value }}</UiNotice>
  </div>
</template>

<style scoped>
.invite {
  display: grid;
  gap: 8px;
}
.invite__link {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.invite__input {
  flex: 1 1 220px;
  min-width: 0;
  padding: 8px 10px;
  background: var(--sunken);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}
.invite__hint {
  flex-basis: 100%;
  margin: 0;
  color: var(--muted);
  font-size: var(--fs-14);
}
</style>
