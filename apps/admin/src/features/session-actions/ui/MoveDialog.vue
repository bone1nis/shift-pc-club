<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UiButton, UiDialog, UiNotice, UiSelect } from '@shift/ui'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{
  title: string
  candidates: { id: number; name: string }[]
  pending?: boolean
  error?: string
}>()
const emit = defineEmits<{ confirm: [workstationId: number] }>()
const target = ref<number | null>(null)
const options = computed(() => props.candidates.map((c) => ({ value: c.id, label: c.name })))
watch(open, (value) => {
  if (value) target.value = props.candidates[0]?.id ?? null
})
</script>

<template>
  <UiDialog v-model="open" :title="title" description="Свободные компьютеры в той же зоне.">
    <UiSelect v-model="target" label="Новое место" :options="options" />
    <UiNotice v-if="error" tone="error">{{ error }}</UiNotice>
    <template #actions>
      <UiButton variant="ghost" @click="open = false">Отмена</UiButton>
      <UiButton
        :loading="pending"
        :disabled="target === null"
        @click="target !== null && emit('confirm', target)"
        >Пересадить</UiButton
      >
    </template>
  </UiDialog>
</template>
