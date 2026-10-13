<script setup lang="ts">
import { UiButton, UiIcon, UiNotice, UiPanel } from '@shift/ui'
import { dateTime, money } from '@fsd/shared/format'

defineProps<{
  range: { starts_at: string; ends_at: string } | null
  hours: number
  /** Выбранные места с ценой: часовая ставка и сумма за выбранную длительность. */
  seats: { name: string; hourly: number; total: number }[]
  total: number
  error?: string
  pending?: boolean
  loading?: boolean
  signedIn: boolean
}>()
defineEmits<{ book: [] }>()
</script>

<template>
  <UiPanel class="summary" eyebrow="Your next session">
    <h3 class="summary__title">Твоя бронь</h3>
    <template v-if="range">
      <div class="summary__line">
        <span>Начало</span><b>{{ dateTime(range.starts_at) }}</b>
      </div>
      <div class="summary__line">
        <span>До</span><b>{{ dateTime(range.ends_at) }}</b>
      </div>
    </template>
    <div class="summary__line">
      <span>Длительность</span><b>{{ hours }} ч</b>
    </div>
    <hr class="summary__divider" />
    <div>
      <p class="summary__small">Выбрано мест: {{ seats.length }}</p>
      <ul v-if="seats.length" class="summary__seats">
        <li v-for="seat in seats" :key="seat.name">
          <b>{{ seat.name }}</b>
          <span class="summary__calc"
            >{{ money(seat.hourly) }} / ч × {{ hours }} ч = <b>{{ money(seat.total) }}</b></span
          >
        </li>
      </ul>
      <p v-else class="summary__small">Нажми на свободные компьютеры на схеме.</p>
    </div>
    <div class="summary__line">
      <span>{{ seats.length > 1 ? `Итого за ${seats.length} места` : 'Предварительно' }}</span
      ><span class="summary__total">{{ money(total) }}</span>
    </div>
    <UiNotice v-if="error" tone="error">{{ error }}</UiNotice>
    <UiButton :loading="pending" :disabled="!seats.length || loading" @click="$emit('book')"
      >{{ signedIn ? 'Подтвердить бронь' : 'Войти и забронировать' }} <UiIcon name="arrow-up-right"
    /></UiButton>
    <p class="summary__small">Окончательная стоимость фиксируется сервером. Оплата — в клубе.</p>
  </UiPanel>
</template>

<style scoped>
.summary {
  position: sticky;
  top: 32px;
}
.summary__title {
  font-family: var(--font-display);
  font-size: var(--fs-32);
  text-transform: uppercase;
}
.summary__line {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: var(--fs-13);
}
.summary__line span:first-child {
  color: var(--muted);
}
.summary__total {
  font-family: var(--font-display);
  font-size: var(--fs-48);
  line-height: 1;
}
.summary__divider {
  width: 100%;
  margin: 0;
  border: 0;
  border-top: 1px solid var(--line);
}
.summary__small {
  font-size: var(--fs-13);
  color: var(--muted);
}
.summary__seats {
  display: grid;
  gap: 8px;
  margin: 11px 0 0;
  padding: 0;
  list-style: none;
}
.summary__seats li {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  background: var(--olive-16);
  border-radius: var(--radius-sm);
  font-size: var(--fs-13);
}
.summary__seats b:first-child {
  color: var(--acid);
}
.summary__calc {
  font-size: var(--fs-12);
  color: var(--muted);
}
.summary__calc b {
  color: var(--text);
}
@media (max-width: 760px) {
  .summary {
    position: static;
  }
}
</style>
