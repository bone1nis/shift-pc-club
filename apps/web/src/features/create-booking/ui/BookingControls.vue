<script setup lang="ts">
import { UiDateTimePicker, UiPanel, UiSegmented } from '@shift/ui'

defineProps<{ minimum: string; pending?: boolean }>()
const start = defineModel<string>('start', { required: true })
const hours = defineModel<number>('hours', { required: true })
const durations = [1, 2, 3, 5].map((value) => ({ value, label: `${value} ч` }))
</script>

<template>
  <UiPanel>
    <div class="controls">
      <UiDateTimePicker
        id="start"
        v-model="start"
        label="Когда играем?"
        :min="minimum"
        :step="30"
        required
      />
      <UiSegmented
        v-model="hours"
        label="Продолжительность"
        :options="durations"
        :disabled="pending"
      />
    </div>
  </UiPanel>
</template>

<style scoped>
.controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
@media (max-width: 760px) {
  .controls {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
}
</style>
