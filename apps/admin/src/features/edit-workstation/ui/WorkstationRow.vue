<script setup lang="ts">
import { UiButton, UiField, UiNumberInput, UiStatus } from '@shift/ui'
import type { Workstation } from '@shift/contracts'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'
import { useDraft } from '@fsd/shared/lib'

const props = defineProps<{ workstation: Workstation; zoneName: string }>()
const ops = useOperationsStore()
const specFields = [
  ['cpu', 'Процессор'],
  ['gpu', 'Видеокарта'],
  ['ram', 'Память'],
  ['monitor', 'Монитор'],
] as const

const draft = useDraft(() => ({
  name: props.workstation.name,
  x: props.workstation.x,
  y: props.workstation.y,
  specs: { ...props.workstation.specs },
}))

const save = () =>
  ops.run(
    () =>
      api(`/api/club/admin/workstations/${props.workstation.id}`, {
        method: 'PATCH',
        body: JSON.stringify(draft.value),
      }),
    `Данные ${props.workstation.name} сохранены.`,
  )
function toggleMaintenance() {
  const status = props.workstation.status === 'maintenance' ? 'available' : 'maintenance'
  return ops.run(
    () =>
      api(`/api/club/admin/workstations/${props.workstation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    `${props.workstation.name}: ${status === 'maintenance' ? 'обслуживание' : 'доступен'}.`,
  )
}
</script>

<template>
  <tr>
    <td class="cell-name">
      <UiField
        v-model="draft.name"
        :label="`Название ${workstation.name}`"
        hide-label
        :maxlength="80"
        class="field-compact"
      />
    </td>
    <td>{{ zoneName }}</td>
    <td>
      <div class="specs">
        <UiField
          v-for="[key, label] in specFields"
          :key="key"
          v-model="draft.specs[key]"
          :label="`${label} ${workstation.name}`"
          hide-label
          :maxlength="120"
          class="field-compact"
        />
      </div>
    </td>
    <td>
      <div class="position">
        <UiNumberInput
          v-model="draft.x"
          hide-label
          :label="`X ${workstation.name}`"
          :min="0"
          :max="1000"
        />
        <UiNumberInput
          v-model="draft.y"
          hide-label
          :label="`Y ${workstation.name}`"
          :min="0"
          :max="1000"
        />
      </div>
    </td>
    <td>
      <UiStatus :tone="workstation.status === 'available' ? 'success' : 'danger'">{{
        workstation.status === 'available' ? 'Доступен' : 'Обслуживание'
      }}</UiStatus>
    </td>
    <td>
      <div class="actions">
        <UiButton variant="secondary" size="sm" :disabled="ops.pending" @click="save"
          >Сохранить данные</UiButton
        ><UiButton
          :variant="workstation.status === 'available' ? 'danger' : 'ghost'"
          size="sm"
          :disabled="ops.pending"
          @click="toggleMaintenance"
          >{{ workstation.status === 'available' ? 'Обслуживание' : 'Вернуть в зал' }}</UiButton
        >
      </div>
    </td>
  </tr>
</template>

<style scoped>
.cell-name {
  min-width: 176px;
}
.specs {
  display: grid;
  gap: 8px;
  min-width: 224px;
}
.position {
  display: grid;
  gap: 8px;
  min-width: 144px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.field-compact :deep(.field__input) {
  min-height: 40px;
  padding: 8px 12px;
}
</style>
