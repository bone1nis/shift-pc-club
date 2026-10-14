<script setup lang="ts">
import { computed } from 'vue'
import { vAutoAnimate } from '@formkit/auto-animate/vue'
import { UiEmpty, UiPanel, UiSeatMap, UiStatCard } from '@shift/ui'
import { useOperationsStore } from '@fsd/entities/operations'
import { CheckInButton } from '@fsd/features/check-in-booking'
import { SessionTile } from '@fsd/features/session-actions'
import { dateTime } from '@fsd/shared/format'
import { ArrowLink, StatGrid } from '@fsd/shared/ui'

const ops = useOperationsStore()
const catalog = computed(() => ops.catalog!)
const available = computed(() => ops.freeWorkstations.length)
const awaiting = computed(() => ops.sessions.filter((s) => s.status === 'awaiting_checkout').length)
const upcoming = computed(() => ops.confirmedBookings.slice(0, 5))
const seats = computed(() =>
  catalog.value.workstations.map((item) => ({
    id: item.id,
    label: item.name,
    x: item.x,
    y: item.y,
    disabled: true,
    state:
      item.status === 'maintenance'
        ? ('maintenance' as const)
        : ops.sessions.some((s) => s.workstation_id === item.id && s.status === 'awaiting_checkout')
          ? ('attention' as const)
          : ops.activeSessions.some((s) => s.workstation_id === item.id)
            ? ('busy' as const)
            : ('free' as const),
  })),
)
</script>

<template>
  <template v-if="ops.catalog">
    <StatGrid>
      <UiStatCard
        label="Компьютеры"
        :value="available"
        :suffix="`/ ${catalog.workstations.length}`"
        hint="доступно сейчас"
      />
      <UiStatCard label="Активные сессии" :value="ops.activeSessions.length" hint="гостей в зале" />
      <UiStatCard label="Брони" :value="ops.confirmedBookings.length" hint="ожидают посещения" />
      <UiStatCard label="Нужна проверка" :value="awaiting" hint="сессий закончили время" />
    </StatGrid>
    <div class="shift__columns">
      <UiPanel :eyebrow="`Зал / ${catalog.workstations.length} мест`" title="Схема компьютеров">
        <template #actions><ArrowLink to="/equipment">Управлять</ArrowLink></template>
        <UiSeatMap :seats="seats" label="SHIFT / Игровой зал" />
        <p v-if="awaiting" class="shift__attention">
          Мигающие места: оплаченное время закончилось — проверьте и завершите сессию.
        </p>
      </UiPanel>
      <UiPanel eyebrow="Требуют внимания" title="Ближайшие брони">
        <template #actions><ArrowLink to="/schedule">Все брони</ArrowLink></template>
        <article v-for="booking in upcoming" :key="booking.id" class="shift__booking">
          <div>
            <b>Бронь №{{ booking.id }}</b>
            <p>
              {{ dateTime(booking.starts_at) }} · PC
              {{ booking.items.map((item) => item.workstation_id).join(', ') }}
            </p>
          </div>
          <CheckInButton :booking="booking" />
        </article>
        <UiEmpty v-if="!upcoming.length">Подтверждённых броней пока нет.</UiEmpty>
      </UiPanel>
    </div>
    <UiPanel eyebrow="В зале сейчас" title="Игровые сессии">
      <template #actions><ArrowLink to="/schedule">Расписание</ArrowLink></template>
      <div v-if="ops.activeSessions.length" v-auto-animate class="shift__sessions">
        <SessionTile v-for="session in ops.activeSessions" :key="session.id" :session="session" />
      </div>
      <UiEmpty v-else>Активных сессий нет.</UiEmpty>
    </UiPanel>
  </template>
</template>

<style scoped>
.shift__columns {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 20px;
}
.shift__booking {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
  border-top: 1px solid var(--line);
}
.shift__booking p {
  font-size: var(--fs-13);
  color: var(--muted);
}
.shift__attention {
  font-size: var(--fs-13);
  color: var(--warning);
}
.shift__sessions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));
  gap: 16px;
}
@media (max-width: 1100px) {
  .shift__columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
