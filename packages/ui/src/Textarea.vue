<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    id?: string
    rows?: number
    maxlength?: number
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
  }>(),
  { rows: 4, error: '', hint: '', required: false, disabled: false },
)
defineEmits<{ 'update:modelValue': [value: string] }>()
const generated = useId()
const textareaId = computed(() => props.id ?? generated)
</script>

<template>
  <div class="textarea">
    <label :for="textareaId" class="textarea__label">{{ label }}</label>
    <textarea
      :id="textareaId"
      class="textarea__input"
      :value="modelValue"
      :rows="rows"
      :maxlength="maxlength"
      :required="required"
      :disabled="disabled"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>
    <p v-if="maxlength" class="textarea__count" aria-hidden="true">
      {{ modelValue.length }} / {{ maxlength }}
    </p>
    <p v-if="error" :id="`${textareaId}-error`" class="textarea__error">{{ error }}</p>
    <p v-else-if="hint" :id="`${textareaId}-hint`" class="textarea__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.textarea {
  display: grid;
  gap: 10px;
  min-width: 0;
}
.textarea__label {
  font-size: var(--fs-13);
  font-weight: 600;
}
.textarea__input {
  width: 100%;
  min-height: 96px;
  padding: 14px 16px;
  background: var(--sunken);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  line-height: 1.5;
  resize: vertical;
  transition: border-color 0.2s;
}
.textarea__input:hover:not(:disabled) {
  border-color: var(--gray-41);
}
.textarea__input:focus-visible {
  border-color: var(--acid);
  outline: none;
}
.textarea__input[aria-invalid='true'] {
  border-color: var(--danger);
}
.textarea__input:disabled {
  opacity: 0.55;
}
.textarea__count {
  justify-self: end;
  font-size: var(--fs-11);
  color: var(--muted);
}
.textarea__error {
  color: var(--danger);
  font-size: var(--fs-14);
}
.textarea__hint {
  color: var(--muted);
  font-size: var(--fs-13);
}
</style>
