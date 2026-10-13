<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UiButton, UiPanel, UiSelect } from '@shift/ui'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'

const ops = useOperationsStore()
const workstation = ref<number | null>(null)
const minutes = ref(120)
const options = computed(() => ops.freeWorkstations.map((w) => ({ value: w.id, label: w.name })))
const durations = [30, 60, 90, 120, 180, 240, 360, 480, 720].map((value) => ({
  value,
  label: `${value} мин`,
}))
watch(
  options,
  (list) => {
    if (!list.some((o) => o.value === workstation.value)) workstation.value = list[0]?.value ?? null
  },
  { immediate: true },
)

function start() {
  if (!workstation.value) return
  return ops.run(
    () =>
      api('/api/booking/admin/sessions', {
        method: 'POST',
        body: JSON.stringify({ workstation_id: workstation.value, minutes: minutes.value }),
      }),
    'Гостевая сессия запущена.',
  )
}
</script>

<template>
  <UiPanel eyebrow="Без аккаунта" title="Запустить гостевую сессию">
    <form novalidate class="guest" @submit.prevent="start">
      <UiSelect v-model="workstation" label="Свободное место" :options="options" required />
      <UiSelect v-model="minutes" label="Время" :options="durations" />
      <UiButton type="submit" :loading="ops.pending" :disabled="!workstation"
        >Начать сессию</UiButton
      >
    </form>
  </UiPanel>
</template>

<style scoped>
.guest {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
  gap: 16px;
  align-items: end;
}
@media (max-width: 760px) {
  .guest {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
