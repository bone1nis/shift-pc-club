<script setup lang="ts">
import { ref } from 'vue'
import { UiButton } from '@shift/ui'
import { SecretError, secretFailure, type SecretMessage } from '../model/secretChat'

const props = defineProps<{
  message: SecretMessage
  reveal: (message: SecretMessage) => Promise<string>
}>()

// Расшифрованный текст живёт только здесь: не в Query-кэше и не в хранилищах.
const text = ref<string | null>(null)
const error = ref('')
const busy = ref(false)
const unreadable = ref(false)

async function show() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  unreadable.value = false
  try {
    text.value = await props.reveal(props.message)
  } catch (e) {
    // Только отсутствие конверта для этого устройства окончательно; остальные ошибки временные.
    unreadable.value = e instanceof SecretError && e.code === 'no_envelope'
    error.value = secretFailure(e)
  } finally {
    busy.value = false
  }
}
function hide() {
  text.value = null
}
</script>

<template>
  <div class="secret">
    <template v-if="text !== null">
      <span class="chat__body secret__text">{{ text }}</span>
      <span class="secret__warn">Скриншот и копирование защитить нельзя.</span>
      <UiButton variant="ghost" size="sm" @click="hide">Скрыть</UiButton>
    </template>
    <span v-else-if="message.redacted" class="chat__body chat__body--secret"
      >Секретное сообщение. Текст вам недоступен.</span
    >
    <template v-else>
      <UiButton variant="secondary" size="sm" :loading="busy" :disabled="unreadable" @click="show">
        {{ error ? 'Повторить' : 'Секретное сообщение, нажми, чтобы показать' }}
      </UiButton>
      <span v-if="error" class="secret__error" role="alert">{{ error }}</span>
    </template>
  </div>
</template>

<style scoped>
.secret {
  display: grid;
  gap: 4px;
  justify-items: start;
}
.secret__text {
  font-family: var(--font-mono, monospace);
}
.secret__warn {
  color: var(--muted);
  font-size: var(--fs-12);
}
.secret__error {
  font-size: var(--fs-14);
}
</style>
