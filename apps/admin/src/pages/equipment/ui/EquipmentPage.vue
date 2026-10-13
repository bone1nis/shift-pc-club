<script setup lang="ts">
import { computed } from 'vue'
import { UiPanel, UiTable } from '@shift/ui'
import { useOperationsStore } from '@fsd/entities/operations'
import { WorkstationRow } from '@fsd/features/edit-workstation'

const ops = useOperationsStore()
const catalog = computed(() => ops.catalog!)
const zoneName = (id: number) => catalog.value.zones.find((zone) => zone.id === id)?.name || '—'
</script>

<template>
  <UiPanel v-if="ops.catalog" eyebrow="SHIFT / Зал" title="Оборудование и схема">
    <template #actions
      ><span class="equipment__hint">Координаты задаются в шагах сетки.</span></template
    >
    <UiTable label="Оборудование">
      <thead>
        <tr>
          <th>Место</th>
          <th>Зона</th>
          <th>Характеристики</th>
          <th>Схема X / Y</th>
          <th>Статус</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        <WorkstationRow
          v-for="workstation in catalog.workstations"
          :key="workstation.id"
          :workstation="workstation"
          :zone-name="zoneName(workstation.zone_id)"
        />
      </tbody>
    </UiTable>
  </UiPanel>
</template>

<style scoped>
.equipment__hint {
  font-size: var(--fs-13);
  color: var(--muted);
}
</style>
