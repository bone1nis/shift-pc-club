<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  WEEKDAYS,
  addDays,
  addMonths,
  compareDates,
  formatLongDay,
  formatMonth,
  isoDate,
  monthGrid,
  parseDate,
  type DateParts,
} from './lib/date'

const props = withDefaults(defineProps<{ modelValue: string; min?: string; max?: string }>(), {
  min: '',
  max: '',
})
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const today = (() => {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
})()
const selected = computed(() => parseDate(props.modelValue))
const minDate = computed(() => parseDate(props.min))
const maxDate = computed(() => parseDate(props.max))
const initial = selected.value ?? minDate.value ?? today
const view = ref<DateParts>({ year: initial.year, month: initial.month, day: 1 })
const focused = ref<DateParts>(initial)
const root = ref<HTMLElement | null>(null)

watch(selected, (value) => {
  if (value) {
    view.value = { year: value.year, month: value.month, day: 1 }
    focused.value = value
  }
})

const cells = computed(() => monthGrid(view.value.year, view.value.month))
const weeks = computed(() =>
  Array.from({ length: 6 }, (_, i) => cells.value.slice(i * 7, i * 7 + 7)),
)
const title = computed(() => formatMonth(view.value))

function disabled(date: DateParts) {
  return (
    (minDate.value !== null && compareDates(date, minDate.value) < 0) ||
    (maxDate.value !== null && compareDates(date, maxDate.value) > 0)
  )
}
const sameDay = (a: DateParts | null, b: DateParts) => !!a && compareDates(a, b) === 0

function showMonth(date: DateParts) {
  view.value = { year: date.year, month: date.month, day: 1 }
}
function shiftMonth(delta: number) {
  const next = addMonths({ ...view.value, day: 1 }, delta)
  showMonth(next)
  focused.value = { ...next, day: Math.min(focused.value.day, 28) }
}
function pick(date: DateParts) {
  if (disabled(date)) return
  emit('update:modelValue', isoDate(date))
}
async function moveFocus(date: DateParts) {
  focused.value = date
  if (date.month !== view.value.month || date.year !== view.value.year) showMonth(date)
  await nextTick()
  root.value
    ?.querySelector<HTMLButtonElement>(`[data-date="${isoDate(date)}"]`)
    ?.focus({ preventScroll: true })
}
function onKey(event: KeyboardEvent) {
  const map: Record<string, () => DateParts> = {
    ArrowLeft: () => addDays(focused.value, -1),
    ArrowRight: () => addDays(focused.value, 1),
    ArrowUp: () => addDays(focused.value, -7),
    ArrowDown: () => addDays(focused.value, 7),
    PageUp: () => addMonths(focused.value, -1),
    PageDown: () => addMonths(focused.value, 1),
    Home: () =>
      addDays(
        focused.value,
        -(
          (new Date(
            Date.UTC(focused.value.year, focused.value.month - 1, focused.value.day),
          ).getUTCDay() +
            6) %
          7
        ),
      ),
    End: () =>
      addDays(
        focused.value,
        6 -
          ((new Date(
            Date.UTC(focused.value.year, focused.value.month - 1, focused.value.day),
          ).getUTCDay() +
            6) %
            7),
      ),
  }
  const handler = map[event.key]
  if (!handler) return
  event.preventDefault()
  void moveFocus(handler())
}
function tabbable(date: DateParts) {
  return sameDay(focused.value, date) && date.month === view.value.month
}
defineExpose({
  focus: () =>
    root.value
      ?.querySelector<HTMLButtonElement>('[tabindex="0"][data-date]')
      ?.focus({ preventScroll: true }),
})
</script>

<template>
  <div ref="root" class="calendar">
    <div class="calendar__header">
      <button
        type="button"
        class="calendar__nav"
        aria-label="Предыдущий месяц"
        @click="shiftMonth(-1)"
      >
        ‹
      </button>
      <strong class="calendar__title" aria-live="polite">{{ title }}</strong>
      <button
        type="button"
        class="calendar__nav"
        aria-label="Следующий месяц"
        @click="shiftMonth(1)"
      >
        ›
      </button>
    </div>
    <div class="calendar__grid" role="grid" :aria-label="title" @keydown="onKey">
      <div class="calendar__row" role="row">
        <span v-for="day in WEEKDAYS" :key="day" class="calendar__weekday" role="columnheader">{{
          day
        }}</span>
      </div>
      <div v-for="(week, index) in weeks" :key="index" class="calendar__row" role="row">
        <span
          v-for="date in week"
          :key="isoDate(date)"
          role="gridcell"
          :aria-selected="sameDay(selected, date)"
        >
          <button
            type="button"
            class="calendar__day"
            :class="{
              'calendar__day--outside': date.month !== view.month,
              'calendar__day--today': sameDay(today, date),
              'calendar__day--selected': sameDay(selected, date),
            }"
            :data-date="isoDate(date)"
            :tabindex="tabbable(date) ? 0 : -1"
            :disabled="disabled(date)"
            :aria-label="formatLongDay(date)"
            :aria-current="sameDay(today, date) ? 'date' : undefined"
            @click="pick(date)"
          >
            {{ date.day }}
          </button>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar {
  display: grid;
  gap: 10px;
  width: 100%;
  min-width: 280px;
}
.calendar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.calendar__title {
  text-transform: capitalize;
  font-size: var(--fs-15);
}
.calendar__nav {
  width: 38px;
  height: 38px;
  background: var(--sunken);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  color: var(--acid);
  font-size: var(--fs-20);
  line-height: 1;
}
.calendar__nav:hover {
  border-color: var(--acid);
}
.calendar__grid {
  display: grid;
  gap: 3px;
}
.calendar__row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}
.calendar__weekday {
  padding: 6px 0;
  text-align: center;
  font-size: var(--fs-10);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.calendar__day {
  width: 100%;
  height: 38px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--fs-14);
  font-variant-numeric: tabular-nums;
}
.calendar__day:hover:not(:disabled) {
  border-color: var(--acid);
}
.calendar__day--outside {
  color: var(--gray-42);
}
.calendar__day--today {
  border-color: var(--line-strong);
}
.calendar__day--selected,
.calendar__day--selected:hover:not(:disabled) {
  background: var(--acid);
  border-color: var(--acid);
  color: var(--acid-ink);
  font-weight: 800;
}
.calendar__day:disabled {
  opacity: 0.28;
}
</style>
