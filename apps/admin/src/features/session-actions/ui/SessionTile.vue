<script setup lang="ts">
import { computed, ref } from 'vue'
import { UiButton, UiStatus } from '@shift/ui'
import type { GamingSession } from '@shift/contracts'
import { sessionLabel, statusTone, useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'
import { dateTime } from '@fsd/shared/format'
import ExtendDialog from './ExtendDialog.vue'
import MoveDialog from './MoveDialog.vue'

const props = defineProps<{ session: GamingSession }>()
const ops = useOperationsStore()
const extending = ref(false)
const moving = ref(false)

// Продлить и пересадить можно только идущую сессию; закончившуюся нужно завершить.
const running = computed(() => props.session.status === 'active')
function openExtend() {
  ops.error = ''
  extending.value = true
}
function openMove() {
  ops.error = ''
  moving.value = true
}

const candidates = computed(() => {
  const zoneId = ops.catalog?.workstations.find(
    (w) => w.id === props.session.workstation_id,
  )?.zone_id
  return ops.freeWorkstations.filter(
    (w) => w.id !== props.session.workstation_id && w.zone_id === zoneId,
  )
})

const end = () =>
  ops.run(
    () => api(`/api/booking/admin/sessions/${props.session.id}/end`, { method: 'POST' }),
    `Сессия №${props.session.id} завершена.`,
  )
async function extend(minutes: number) {
  const done = await ops.run(
    () =>
      api(`/api/booking/admin/sessions/${props.session.id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ minutes }),
      }),
    `Сессия №${props.session.id} продлена на ${minutes} мин.`,
  )
  if (done) extending.value = false
}
async function move(workstationId: number) {
  const done = await ops.run(
    () =>
      api(`/api/booking/admin/sessions/${props.session.id}/move`, {
        method: 'POST',
        body: JSON.stringify({ workstation_id: workstationId }),
      }),
    `Сессия №${props.session.id} пересажена.`,
  )
  if (done) moving.value = false
}
</script>

<template>
  <article class="tile">
    <div class="tile__row">
      <b>PC #{{ session.workstation_id }}</b
      ><UiStatus :tone="statusTone(session.status)">{{ sessionLabel[session.status] }}</UiStatus>
    </div>
    <p class="tile__meta">Сессия №{{ session.id }} · до {{ dateTime(session.ends_at) }}</p>
    <p v-if="!running" class="tile__hint">
      Время вышло: продлить или пересадить нельзя, завершите сессию.
    </p>
    <div class="tile__actions">
      <UiButton
        variant="secondary"
        size="sm"
        :disabled="ops.pending || !running"
        @click="openExtend"
        >Продлить</UiButton
      ><UiButton
        variant="ghost"
        size="sm"
        :disabled="ops.pending || !running || !candidates.length"
        @click="openMove"
        >Пересадить</UiButton
      ><UiButton variant="danger" size="sm" :disabled="ops.pending" @click="end"
        >Завершить</UiButton
      >
    </div>
    <ExtendDialog
      v-model="extending"
      :title="`Продлить сессию №${session.id}`"
      :pending="ops.pending"
      :error="ops.error"
      @confirm="extend"
    />
    <MoveDialog
      v-model="moving"
      :title="`Пересадить сессию №${session.id}`"
      :candidates="candidates"
      :pending="ops.pending"
      :error="ops.error"
      @confirm="move"
    />
  </article>
</template>

<style scoped>
.tile {
  display: grid;
  gap: 13px;
  padding: 19px;
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.tile__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.tile__meta {
  font-size: var(--fs-13);
  color: var(--muted);
}
.tile__hint {
  font-size: var(--fs-12);
  color: var(--warning);
}
.tile__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
