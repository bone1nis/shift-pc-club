<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import Calendar from './Calendar.vue'
import Icon from './Icon.vue'
import { formatDateTime, isoTime, parseDate, parseTime, timeSlots } from './lib/date'
import { usePopover } from './lib/popover'

/** Значение — «настенное» время вида `YYYY-MM-DDTHH:mm` без часового пояса. */
const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    id?: string
    /** Минимально допустимые дата и время, `YYYY-MM-DDTHH:mm`. */
    min?: string
    /** Шаг времени в минутах. */
    step?: number
    placeholder?: string
    error?: string
    required?: boolean
    disabled?: boolean
  }>(),
  {
    min: '',
    step: 30,
    placeholder: 'Выберите дату и время',
    error: '',
    required: false,
    disabled: false,
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const generated = useId()
const baseId = computed(() => props.id ?? generated)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const calendar = ref<InstanceType<typeof Calendar> | null>(null)
const { open, style, toggle, close, place } = usePopover({ trigger, panel })

const datePart = computed(() => (parseDate(props.modelValue) ? props.modelValue.slice(0, 10) : ''))
const timePart = computed(() => {
  const time = parseTime(props.modelValue)
  return time ? isoTime(time.hours, time.minutes) : ''
})
const minDate = computed(() => props.min.slice(0, 10))
const minMinutes = computed(() => {
  const time = parseTime(props.min)
  return time ? time.hours * 60 + time.minutes : 0
})
const slots = computed(() =>
  timeSlots(props.step, datePart.value && datePart.value === minDate.value ? minMinutes.value : 0),
)
const text = computed(() => formatDateTime(props.modelValue))

async function onToggle() {
  toggle()
  if (open.value) {
    await nextTick()
    await nextTick()
    calendar.value?.focus()
    panel.value
      ?.querySelector<HTMLElement>('.dtp__slot--active')
      ?.scrollIntoView?.({ block: 'nearest' })
  }
}
function firstSlot(date: string) {
  const list = timeSlots(props.step, date === minDate.value ? minMinutes.value : 0)
  return list.includes(timePart.value) ? timePart.value : (list[0] ?? '00:00')
}
function onDate(date: string) {
  emit('update:modelValue', `${date}T${firstSlot(date)}`)
  void nextTick(place)
}
function onTime(time: string) {
  emit('update:modelValue', `${datePart.value || minDate.value}T${time}`)
}
function onSlotKey(event: KeyboardEvent, index: number) {
  const target = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: slots.value.length - 1 }[
    event.key as 'ArrowDown'
  ]
  if (target === undefined) return
  event.preventDefault()
  panel.value
    ?.querySelectorAll<HTMLButtonElement>('.dtp__slot')
    [Math.min(slots.value.length - 1, Math.max(0, target))]?.focus()
}
</script>

<template>
  <div class="dtp">
    <span :id="`${baseId}-label`" class="dtp__label">{{ label }}</span>
    <button
      :id="baseId"
      ref="trigger"
      type="button"
      class="dtp__trigger"
      :class="{ 'dtp__trigger--placeholder': !text }"
      :disabled="disabled"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-labelledby="`${baseId}-label ${baseId}`"
      :data-invalid="!!error || undefined"
      :aria-describedby="error ? `${baseId}-error` : undefined"
      :data-value="modelValue"
      @click="onToggle"
    >
      <span>{{ text || placeholder }}</span>
      <Icon class="dtp__icon" name="clock" size="18px" :stroke="1.6" />
    </button>
    <p v-if="error" :id="`${baseId}-error`" class="dtp__error">{{ error }}</p>
    <Teleport to="body">
      <Transition name="pop">
        <div
          v-if="open"
          ref="panel"
          class="dtp__panel"
          :style="style"
          role="dialog"
          :aria-label="label"
        >
          <Calendar
            ref="calendar"
            :model-value="datePart"
            :min="minDate"
            @update:model-value="onDate"
          />
          <div class="dtp__times" role="listbox" aria-label="Время">
            <button
              v-for="(slot, index) in slots"
              :key="slot"
              type="button"
              class="dtp__slot"
              :class="{ 'dtp__slot--active': slot === timePart }"
              role="option"
              :aria-selected="slot === timePart"
              :disabled="!datePart"
              @click="onTime(slot)"
              @keydown="onSlotKey($event, index)"
            >
              {{ slot }}
            </button>
            <p v-if="!slots.length" class="dtp__none">На этот день свободного времени нет.</p>
          </div>
          <button type="button" class="dtp__done" @click="close(true)">Готово</button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.dtp {
  display: grid;
  gap: 10px;
  min-width: 0;
}
.dtp__label {
  font-size: var(--fs-13);
  font-weight: 600;
}
.dtp__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 13px;
  width: 100%;
  min-height: 51px;
  padding: 14px 16px;
  background: var(--sunken);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  text-align: left;
  transition: border-color 0.2s;
}
.dtp__trigger:hover:not(:disabled) {
  border-color: var(--gray-41);
}
.dtp__trigger[aria-expanded='true'],
.dtp__trigger:focus-visible {
  border-color: var(--acid);
}
.dtp__trigger[data-invalid='true'] {
  border-color: var(--danger);
}
.dtp__trigger:disabled {
  opacity: 0.55;
}
.dtp__trigger--placeholder span {
  color: var(--gray-42);
}
.dtp__icon {
  color: var(--acid);
}
.dtp__error {
  color: var(--danger);
  font-size: var(--fs-14);
}
.dtp__panel {
  position: fixed;
  top: 0;
  left: 0;
  z-index: var(--z-popover);
  display: grid;
  grid-template-columns: minmax(280px, 1fr) 104px;
  gap: 16px;
  padding: 16px;
  background: var(--raised);
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  box-shadow: var(--shadow-pop);
}
.dtp__times {
  display: grid;
  align-content: start;
  gap: 4px;
  max-height: 312px;
  overflow: auto;
  padding-right: 3px;
}
.dtp__slot {
  min-height: 35px;
  background: var(--sunken);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--fs-13);
  font-variant-numeric: tabular-nums;
}
.dtp__slot:hover:not(:disabled) {
  border-color: var(--acid);
}
.dtp__slot--active {
  background: var(--acid);
  color: var(--acid-ink);
  font-weight: 800;
}
.dtp__slot:disabled {
  opacity: 0.35;
}
.dtp__none {
  font-size: var(--fs-13);
  color: var(--muted);
}
.dtp__done {
  display: none;
  grid-column: 1 / -1;
  min-height: 45px;
  background: var(--acid);
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--acid-ink);
  font-weight: 800;
  text-transform: uppercase;
}
@media (max-width: 700px) {
  .dtp__panel {
    /* На телефоне — шторка снизу экрана. */
    left: 8px !important;
    right: 8px !important;
    top: auto !important;
    bottom: 8px !important;
    max-height: calc(100vh - 16px) !important;
    grid-template-columns: 1fr;
  }
  .dtp__times {
    grid-template-columns: repeat(4, 1fr);
    max-height: 144px;
  }
  .dtp__done {
    display: block;
  }
}

.pop-enter-active,
.pop-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
