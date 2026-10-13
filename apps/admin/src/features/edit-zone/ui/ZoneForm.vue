<script setup lang="ts">
import { UiButton, UiField, UiPanel } from '@shift/ui'
import type { Zone } from '@shift/contracts'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'
import { useDraft } from '@fsd/shared/lib'

const props = defineProps<{ zone: Zone }>()
const ops = useOperationsStore()
const draft = useDraft(() => ({
  name: props.zone.name,
  slug: props.zone.slug,
  description: props.zone.description,
}))
const save = () =>
  ops.run(
    () =>
      api(`/api/club/admin/zones/${props.zone.id}`, {
        method: 'PATCH',
        body: JSON.stringify(draft.value),
      }),
    `Зона ${props.zone.name} сохранена.`,
  )
</script>

<template>
  <UiPanel :title="`Зона: ${zone.name}`">
    <form novalidate class="zone-form" @submit.prevent="save">
      <UiField v-model="draft.name" :label="`Название зоны #${zone.id}`" :maxlength="80" required />
      <UiField v-model="draft.slug" :label="`Slug зоны #${zone.id}`" :maxlength="80" required />
      <UiField
        v-model="draft.description"
        :label="`Описание зоны #${zone.id}`"
        :maxlength="2000"
        required
      />
      <UiButton type="submit" :loading="ops.pending">Сохранить зону #{{ zone.id }}</UiButton>
    </form>
  </UiPanel>
</template>

<style scoped>
.zone-form {
  display: grid;
  gap: 18px;
}
</style>
