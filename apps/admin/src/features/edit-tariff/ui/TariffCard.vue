<script setup lang="ts">
import { UiButton, UiNumberInput, UiPanel } from '@shift/ui'
import type { Tariff } from '@shift/contracts'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'
import { useDraft } from '@fsd/shared/lib'

const props = defineProps<{ tariff: Tariff; zoneName: string }>()
const ops = useOperationsStore()
// В интерфейсе цена в рублях, на сервере — в копейках.
const draft = useDraft(() => ({ rubles: Math.round(props.tariff.hourly_price / 100) }))
const save = () =>
  ops.run(
    () =>
      api(`/api/club/admin/tariffs/${props.tariff.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ hourly_price: draft.value.rubles * 100 }),
      }),
    `Тариф «${props.tariff.name}» обновлён.`,
  )
</script>

<template>
  <UiPanel :eyebrow="zoneName" :title="tariff.name">
    <UiNumberInput v-model="draft.rubles" label="Стоимость за час, ₽" :min="1" :step="1" />
    <p class="hint">
      Новая цена применяется к новым броням. Стоимость уже оформленных броней фиксируется.
    </p>
    <UiButton :loading="ops.pending" @click="save">Сохранить цену</UiButton>
  </UiPanel>
</template>

<style scoped>
.hint {
  font-size: var(--fs-13);
  color: var(--muted);
}
</style>
