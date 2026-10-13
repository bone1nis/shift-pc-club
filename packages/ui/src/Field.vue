<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    id?: string
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url'
    error?: string
    hint?: string
    autocomplete?: string
    placeholder?: string
    maxlength?: number
    required?: boolean
    disabled?: boolean
    /** Визуально скрыть подпись (она остаётся для скринридеров). */
    hideLabel?: boolean
    inputmode?: 'text' | 'numeric' | 'decimal' | 'email' | 'search' | 'tel'
  }>(),
  { type: 'text', error: '', hint: '', autocomplete: undefined, required: false },
)
defineEmits<{ 'update:modelValue': [value: string] }>()
const generated = useId()
const inputId = computed(() => props.id ?? generated)
</script>

<template>
  <div class="field">
    <label :for="inputId" class="field__label" :class="{ 'sr-only': hideLabel }">{{ label }}</label>
    <input
      :id="inputId"
      class="field__input"
      :type="type"
      :value="modelValue"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :required="required"
      :disabled="disabled"
      :inputmode="inputmode"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="error" :id="`${inputId}-error`" class="field__error">{{ error }}</p>
    <p v-else-if="hint" :id="`${inputId}-hint`" class="field__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: 10px;
  min-width: 0;
}
.field__label {
  font-size: var(--fs-13);
  font-weight: 600;
}
.field__input {
  width: 100%;
  background: var(--sunken);
  color: var(--text);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  min-height: 51px;
  padding: 14px 16px;
  transition: border-color 0.2s;
}
.field__input::placeholder {
  color: var(--gray-42);
}
.field__input:hover:not(:disabled) {
  border-color: var(--gray-41);
}
.field__input:focus-visible {
  border-color: var(--acid);
  outline: 2px solid var(--acid);
  outline-offset: 2px;
}
.field__input:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.field__input[aria-invalid='true'] {
  border-color: var(--danger);
}
.field__error {
  color: var(--danger);
  font-size: var(--fs-14);
}
.field__hint {
  color: var(--muted);
  font-size: var(--fs-13);
}
</style>
