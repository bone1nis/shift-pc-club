<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    label: string
    id?: string
    min?: number
    max?: number
    step?: number
    suffix?: string
    error?: string
    required?: boolean
    disabled?: boolean
    hideLabel?: boolean
  }>(),
  { min: -Infinity, max: Infinity, step: 1, error: '', required: false, disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const generated = useId()
const inputId = computed(() => props.id ?? generated)
const text = ref(String(props.modelValue))
watch(
  () => props.modelValue,
  (value) => {
    if (Number(text.value) !== value) text.value = String(value)
  },
)

const clamp = (value: number) => Math.min(props.max, Math.max(props.min, value))
function commit(value: number) {
  const next = clamp(Number.isFinite(value) ? value : props.min === -Infinity ? 0 : props.min)
  text.value = String(next)
  emit('update:modelValue', next)
}
function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value.replace(/[^\d-]/g, '')
  const value = Number(text.value)
  if (text.value !== '' && text.value !== '-' && Number.isFinite(value))
    emit('update:modelValue', value)
}
function bump(direction: 1 | -1) {
  commit((Number(text.value) || 0) + direction * props.step)
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    bump(1)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    bump(-1)
  }
}
</script>

<template>
  <div class="number">
    <label :for="inputId" class="number__label" :class="{ 'sr-only': hideLabel }">{{
      label
    }}</label>
    <div class="number__control" :class="{ 'number__control--invalid': !!error }">
      <button
        type="button"
        class="number__step"
        :disabled="disabled || modelValue <= min"
        aria-label="Уменьшить"
        tabindex="-1"
        @click="bump(-1)"
      >
        −
      </button>
      <input
        :id="inputId"
        class="number__input"
        type="text"
        inputmode="numeric"
        role="spinbutton"
        :value="text"
        :required="required"
        :disabled="disabled"
        :aria-valuemin="min === -Infinity ? undefined : min"
        :aria-valuemax="max === Infinity ? undefined : max"
        :aria-valuenow="modelValue"
        :aria-invalid="!!error"
        @input="onInput"
        @blur="commit(Number(text))"
        @keydown="onKey"
      />
      <span v-if="suffix" class="number__suffix">{{ suffix }}</span>
      <button
        type="button"
        class="number__step"
        :disabled="disabled || modelValue >= max"
        aria-label="Увеличить"
        tabindex="-1"
        @click="bump(1)"
      >
        +
      </button>
    </div>
    <p v-if="error" class="number__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.number {
  display: grid;
  gap: 10px;
  min-width: 0;
}
.number__label {
  font-size: var(--fs-13);
  font-weight: 600;
}
.number__control {
  display: flex;
  align-items: stretch;
  min-height: 51px;
  background: var(--sunken);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  overflow: hidden;
  transition: border-color 0.2s;
}
.number__control:focus-within {
  border-color: var(--acid);
}
.number__control--invalid {
  border-color: var(--danger);
}
.number__input {
  flex: 1;
  min-width: 0;
  padding: 0 10px;
  background: transparent;
  border: 0;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.number__input:focus-visible {
  outline: none;
}
.number__suffix {
  align-self: center;
  padding-right: 8px;
  font-size: var(--fs-13);
  color: var(--muted);
}
.number__step {
  width: 48px;
  flex: none;
  background: var(--raised);
  border: 0;
  font-size: var(--fs-20);
  color: var(--acid);
}
.number__step:hover:not(:disabled) {
  background: var(--gray-19);
}
.number__step:disabled {
  opacity: 0.35;
}
.number__error {
  color: var(--danger);
  font-size: var(--fs-14);
}
</style>
