<script setup lang="ts">
import { ref } from 'vue'
import { UiButton, UiField, UiPanel } from '@shift/ui'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'

const ops = useOperationsStore()
const zone = ref({ name: '', slug: '', description: '' })
async function create() {
  const done = await ops.run(
    () => api('/api/club/admin/zones', { method: 'POST', body: JSON.stringify(zone.value) }),
    'Зона добавлена.',
  )
  if (done) zone.value = { name: '', slug: '', description: '' }
}
</script>

<template>
  <UiPanel eyebrow="Новая зона" title="Добавить зал">
    <form novalidate class="new-zone" @submit.prevent="create">
      <UiField v-model="zone.name" label="Название" :maxlength="80" required />
      <UiField
        v-model="zone.slug"
        label="Код"
        :maxlength="80"
        hint="Латиница, цифры, - и _"
        required
      />
      <UiField v-model="zone.description" label="Описание" :maxlength="2000" required />
      <UiButton type="submit" :loading="ops.pending">Добавить зону</UiButton>
    </form>
  </UiPanel>
</template>

<style scoped>
.new-zone {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: 16px;
  align-items: start;
}
.new-zone :deep(.button) {
  margin-top: 27px;
}
@media (max-width: 900px) {
  .new-zone {
    grid-template-columns: minmax(0, 1fr);
  }
  .new-zone :deep(.button) {
    margin-top: 0;
  }
}
</style>
