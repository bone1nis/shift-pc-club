<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import Calendar from './Calendar.vue'
import Icon from './Icon.vue'
import { formatDay, parseDate } from './lib/date'
import { usePopover } from './lib/popover'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    id?: string
    min?: string
    max?: string
    placeholder?: string
    error?: string
    required?: boolean
    disabled?: boolean
  }>(),
  { min: '', max: '', placeholder: 'Выберите дату', error: '', required: false, disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const generated = useId()
const baseId = computed(() => props.id ?? generated)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const calendar = ref<InstanceType<typeof Calendar> | null>(null)
const { open, style, toggle, close } = usePopover({ trigger, panel })
const text = computed(() => {
  const date = parseDate(props.modelValue)
  return date ? formatDay(date) : ''
})

async function onToggle() {
  toggle()
  if (open.value) {
    await nextTick()
    await nextTick()
    calendar.value?.focus()
  }
}
function onPick(value: string) {
  emit('update:modelValue', value)
  close(true)
}
</script>

<template>
  <div class="picker">
    <span :id="`${baseId}-label`" class="picker__label">{{ label }}</span>
    <button
      :id="baseId"
      ref="trigger"
      type="button"
      class="picker__trigger"
      :class="{ 'picker__trigger--placeholder': !text }"
      :disabled="disabled"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-labelledby="`${baseId}-label ${baseId}`"
      :data-invalid="!!error || undefined"
      :aria-describedby="error ? `${baseId}-error` : undefined"
      @click="onToggle"
    >
      <span>{{ text || placeholder }}</span>
      <Icon class="picker__icon" name="calendar" size="18px" :stroke="1.6" />
    </button>
    <p v-if="error" :id="`${baseId}-error`" class="picker__error">{{ error }}</p>
    <Teleport to="body">
      <Transition name="pop">
        <div
          v-if="open"
          ref="panel"
          class="picker__panel"
          :style="style"
          role="dialog"
          :aria-label="label"
        >
          <Calendar
            ref="calendar"
            :model-value="modelValue"
            :min="min"
            :max="max"
            @update:model-value="onPick"
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.picker {
  display: grid;
  gap: 10px;
  min-width: 0;
}
.picker__label {
  font-size: var(--fs-13);
  font-weight: 600;
}
.picker__trigger {
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
.picker__trigger:hover:not(:disabled) {
  border-color: var(--gray-41);
}
.picker__trigger[aria-expanded='true'],
.picker__trigger:focus-visible {
  border-color: var(--acid);
}
.picker__trigger[data-invalid='true'] {
  border-color: var(--danger);
}
.picker__trigger:disabled {
  opacity: 0.55;
}
.picker__trigger--placeholder span {
  color: var(--gray-42);
}
.picker__icon {
  color: var(--acid);
}
.picker__error {
  color: var(--danger);
  font-size: var(--fs-14);
}
.picker__panel {
  position: fixed;
  top: 0;
  left: 0;
  z-index: var(--z-popover);
  padding: 16px;
  background: var(--raised);
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  box-shadow: var(--shadow-pop);
}
@media (max-width: 700px) {
  .picker__panel {
    left: 8px !important;
    right: 8px !important;
    top: auto !important;
    bottom: 8px !important;
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
