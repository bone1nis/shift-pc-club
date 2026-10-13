<script setup lang="ts">
import { ref } from 'vue'
import { UiButton } from '@shift/ui'
import { api, errorMessage } from '@fsd/shared/api'
import { dateTime } from '@fsd/shared/format'

export interface AuthSession {
  id: string
  created_at: string
  expires_at: string
}
const sessions = defineModel<AuthSession[]>({ required: true })
const emit = defineEmits<{ revoked: []; failed: [message: string] }>()
const pending = ref(false)

async function revoke(session: AuthSession) {
  if (pending.value) return
  pending.value = true
  try {
    await api(`/api/auth/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' })
    sessions.value = sessions.value.filter((item) => item.id !== session.id)
    emit('revoked')
  } catch (cause) {
    emit('failed', errorMessage(cause))
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="auth-sessions">
    <div class="auth-sessions__head">
      <h3>Сеансы входа</h3>
      <span>{{ sessions.length }}</span>
    </div>
    <p class="auth-sessions__hint">Отозвите сеанс, чтобы завершить вход на другом устройстве.</p>
    <p v-if="!sessions.length" class="auth-sessions__hint">Нет активных сеансов.</p>
    <ul class="auth-sessions__list">
      <li v-for="session in sessions" :key="session.id">
        <span>Создан {{ dateTime(session.created_at) }}</span
        ><UiButton variant="ghost" size="sm" :disabled="pending" @click="revoke(session)"
          >Отозвать</UiButton
        >
      </li>
    </ul>
  </section>
</template>

<style scoped>
.auth-sessions {
  display: grid;
  gap: 13px;
}
.auth-sessions__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.auth-sessions__head span,
.auth-sessions__hint {
  font-size: var(--fs-13);
  color: var(--muted);
}
.auth-sessions__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.auth-sessions__list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid var(--line);
  padding: 10px 0;
  font-size: var(--fs-13);
}
</style>
