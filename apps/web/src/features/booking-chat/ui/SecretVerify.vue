<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UiButton, UiDialog, UiNotice } from '@shift/ui'
import type { PeerFingerprint } from '../model/secretChat'

const props = defineProps<{
  modelValue: boolean
  load: () => Promise<PeerFingerprint[]>
  label: (userId: number) => string
  isVerified: (userId: number) => boolean
  changed: number[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; verify: [userId: number] }>()

const items = ref<PeerFingerprint[]>([])
const loading = ref(false)
const error = ref('')

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    loading.value = true
    error.value = ''
    try {
      items.value = await props.load()
    } catch {
      error.value = 'Не удалось получить ключи участников. Повторите позже.'
    } finally {
      loading.value = false
    }
  },
)
const groups = computed(() => {
  const map = new Map<number, PeerFingerprint[]>()
  for (const i of items.value) map.set(i.userId, [...(map.get(i.userId) ?? []), i])
  return [...map.entries()]
})
</script>

<template>
  <UiDialog
    :model-value="modelValue"
    title="Проверить участников"
    description="Сверьте цифры вживую или другим надёжным способом: у друга на экране должны быть точно такие же. Если цифры разные, не отправляйте секреты."
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p v-if="loading" role="status">Загружаем ключи…</p>
    <UiNotice v-else-if="error" tone="error">{{ error }}</UiNotice>
    <p v-else-if="!groups.length">
      Другие участники ещё не открывали чат на своём устройстве: сверять пока нечего.
    </p>
    <section v-for="[userId, devices] in groups" v-else :key="userId" class="verify">
      <h3 class="verify__name">{{ label(userId) }}</h3>
      <UiNotice v-if="changed.includes(userId)" tone="error">
        У участника изменился ключ — проверьте заново.
      </UiNotice>
      <p v-else-if="isVerified(userId)" class="verify__ok">Отмечен как проверенный.</p>
      <p v-for="d in devices" :key="d.deviceId" class="verify__digits">
        <span class="sr-only">Устройство {{ d.deviceId }}, отпечаток: </span>{{ d.fingerprint }}
      </p>
      <UiButton
        variant="secondary"
        size="sm"
        :disabled="isVerified(userId) && !changed.includes(userId)"
        @click="emit('verify', userId)"
      >
        Отметить проверенным
      </UiButton>
    </section>
  </UiDialog>
</template>

<style scoped>
.verify {
  display: grid;
  gap: 8px;
  justify-items: start;
  margin-bottom: 16px;
}
.verify__name {
  margin: 0;
  font-size: var(--fs-16, 1rem);
}
.verify__digits {
  margin: 0;
  font-family: var(--font-mono, monospace);
  letter-spacing: 0.05em;
  overflow-wrap: anywhere;
}
.verify__ok {
  margin: 0;
  color: var(--muted);
}
</style>
