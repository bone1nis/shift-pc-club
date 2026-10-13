<script setup lang="ts">
import Icon from './Icon.vue'
import { computed } from 'vue'

const props = defineProps<{
  seats: {
    id: number
    label: string
    x: number
    y: number
    disabled?: boolean
    selected?: boolean
    state?: 'free' | 'busy' | 'maintenance' | 'attention'
  }[]
  label?: string
}>()
defineEmits<{ select: [id: number] }>()
const columns = computed(() => Math.max(1, ...props.seats.map((s) => s.x + 1)))
const stateLabel = (state?: string) =>
  state === 'busy'
    ? ', занято'
    : state === 'maintenance'
      ? ', обслуживание'
      : state === 'attention'
        ? ', время вышло, нужно освободить'
        : ', свободно'
</script>

<template>
  <div class="seat-map">
    <div class="seat-map__header">
      <span class="seat-map__title">{{ label || 'Схема зала' }}</span
      ><span class="seat-map__count">{{ seats.length }} мест</span>
    </div>
    <div
      class="seat-map__grid"
      :style="{ gridTemplateColumns: 'repeat(' + columns + ',minmax(0,1fr))' }"
    >
      <button
        v-for="seat in seats"
        :key="seat.id"
        type="button"
        class="seat-map__desk"
        :class="{
          'seat-map__desk--selected': seat.selected,
          'seat-map__desk--busy': seat.state === 'busy',
          'seat-map__desk--maintenance': seat.state === 'maintenance',
          'seat-map__desk--attention': seat.state === 'attention',
        }"
        :style="{ gridColumn: seat.x + 1, gridRow: seat.y + 1 }"
        :disabled="seat.disabled"
        :aria-pressed="!!seat.selected"
        :aria-label="seat.label + stateLabel(seat.state)"
        @click="$emit('select', seat.id)"
      >
        <Icon name="monitor" size="24px" :stroke="1.5" /><span>{{ seat.label }}</span>
      </button>
    </div>
    <div class="seat-map__entry">Вход в зал ↑</div>
  </div>
</template>

<style scoped>
.seat-map {
  border: 1px solid var(--line);
  background: linear-gradient(0deg, var(--olive-10-b), var(--gray-8));
  border-radius: 6px;
  padding: 32px;
  min-height: 352px;
}
.seat-map__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.seat-map__title {
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--muted);
}
.seat-map__count {
  font-size: var(--fs-13);
  color: var(--muted);
}
.seat-map__grid {
  display: grid;
  gap: 16px;
  margin: 32px auto;
  max-width: 576px;
}
.seat-map__desk {
  border: 1px solid var(--olive-37);
  background: var(--olive-14);
  min-height: 72px;
  border-radius: 6px;
  color: var(--olive-82);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  transition: border-color 0.2s;
}
.seat-map__desk span {
  font-size: var(--fs-10);
  font-weight: 700;
}
.seat-map__desk--selected {
  background: var(--acid);
  color: var(--olive-7-a);
  border-color: var(--acid);
}
.seat-map__desk--busy {
  background: var(--amber-16);
  border-color: var(--amber-33);
  color: var(--warning);
}
.seat-map__desk--attention {
  background: var(--amber-15);
  border-color: var(--warning);
  color: var(--amber-85);
  animation: attention 1.6s ease-in-out infinite;
}
@keyframes attention {
  50% {
    box-shadow: 0 0 0 4px var(--warning-a25);
  }
}
.seat-map__desk--maintenance {
  background: var(--gray-15);
  border-color: var(--red-34-a);
  color: var(--red-85);
}
.seat-map__desk:disabled {
  opacity: 0.6;
}
.seat-map__desk:not(:disabled):hover {
  border-color: var(--acid);
}
.seat-map__entry {
  border-top: 1px dashed var(--olive-24);
  text-align: center;
  padding-top: 24px;
  font-size: var(--fs-10);
  color: var(--muted);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
@media (max-width: 700px) {
  .seat-map {
    padding: 16px;
    min-height: 320px;
  }
  .seat-map__grid {
    gap: 8px;
  }
  .seat-map__desk {
    min-height: 61px;
  }
}
</style>
