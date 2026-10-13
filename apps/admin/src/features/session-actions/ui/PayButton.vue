<script setup lang="ts">
import { UiButton } from '@shift/ui'
import type { GamingSession } from '@shift/contracts'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'

const props = defineProps<{ session: GamingSession }>()
const ops = useOperationsStore()
const pay = () =>
  ops.run(
    () => api(`/api/booking/admin/sessions/${props.session.id}/pay`, { method: 'POST' }),
    `Оплата сессии №${props.session.id} отмечена.`,
  )
</script>

<template>
  <UiButton variant="secondary" size="sm" :disabled="ops.pending" @click="pay"
    >Отметить оплату</UiButton
  >
</template>
