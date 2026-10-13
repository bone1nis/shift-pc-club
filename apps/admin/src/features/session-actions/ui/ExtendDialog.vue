<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiButton, UiDialog, UiNotice, UiNumberInput, UiSegmented } from '@shift/ui'

const open = defineModel<boolean>({ required: true })
defineProps<{ title: string; pending?: boolean; error?: string }>()
const emit = defineEmits<{ confirm: [minutes: number] }>()
const minutes = ref(60)
const presets = [30, 60, 120, 180].map((value) => ({ value, label: `${value} мин` }))
watch(open, (value) => {
  if (value) minutes.value = 60
})
</script>

<template>
  <UiDialog v-model="open" :title="title" description="От 30 до 720 минут, шаг 30.">
    <UiSegmented v-model="minutes" label="Быстрый выбор" :options="presets" />
    <UiNumberInput v-model="minutes" label="Продлить на, минут" :min="30" :max="720" :step="30" />
    <UiNotice v-if="error" tone="error">{{ error }}</UiNotice>
    <template #actions>
      <UiButton variant="ghost" @click="open = false">Отмена</UiButton>
      <UiButton :loading="pending" :disabled="minutes % 30 !== 0" @click="emit('confirm', minutes)"
        >Продлить</UiButton
      >
    </template>
  </UiDialog>
</template>
