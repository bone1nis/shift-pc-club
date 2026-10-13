<script setup lang="ts">
import { ref } from 'vue'
import { UiButton, UiDialog } from '@shift/ui'
import { api, errorMessage } from '@fsd/shared/api'

const props = defineProps<{ bookingId: number }>()
const emit = defineEmits<{ cancelled: [id: number]; failed: [message: string] }>()
const open = ref(false)
const pending = ref(false)

async function confirm() {
  if (pending.value) return
  pending.value = true
  try {
    await api(`/api/booking/bookings/${props.bookingId}/cancel`, { method: 'POST' })
    open.value = false
    emit('cancelled', props.bookingId)
  } catch (cause) {
    open.value = false
    emit('failed', errorMessage(cause))
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <UiButton variant="ghost" @click="open = true">Отменить бронь</UiButton>
  <UiDialog
    v-model="open"
    :title="`Отменить бронь №${bookingId}?`"
    description="Места освободятся сразу. Отмена доступна только до начала брони."
  >
    <template #actions>
      <UiButton variant="ghost" @click="open = false">Оставить</UiButton>
      <UiButton variant="danger" :loading="pending" data-autofocus @click="confirm">
        Да, отменить
      </UiButton>
    </template>
  </UiDialog>
</template>
