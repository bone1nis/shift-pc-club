<script setup lang="ts">
export interface SegmentedOption {
  value: string | number
  label: string
  hint?: string
  disabled?: boolean
}
defineProps<{
  modelValue: string | number
  options: SegmentedOption[]
  label?: string
  disabled?: boolean
}>()
defineEmits<{ 'update:modelValue': [value: string | number] }>()
</script>

<template>
  <div class="segmented" role="group" :aria-label="label">
    <span v-if="label" class="segmented__label">{{ label }}</span>
    <div class="segmented__options">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="segmented__option"
        :class="{ 'segmented__option--active': option.value === modelValue }"
        :aria-pressed="option.value === modelValue"
        :disabled="disabled || option.disabled"
        @click="$emit('update:modelValue', option.value)"
      >
        {{ option.label
        }}<span v-if="option.hint" class="segmented__hint"> / {{ option.hint }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.segmented {
  display: grid;
  gap: 10px;
}
.segmented__label {
  font-size: var(--fs-13);
  font-weight: 600;
}
.segmented__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.segmented__option {
  min-height: 42px;
  min-width: 48px;
  padding: 9px 15px;
  background: var(--sunken);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  font-size: var(--fs-13);
  font-weight: 700;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.segmented__option:hover:not(:disabled) {
  border-color: var(--acid);
}
.segmented__option--active {
  background: var(--acid);
  border-color: var(--acid);
  color: var(--acid-ink);
}
.segmented__option:disabled {
  opacity: 0.45;
}
.segmented__hint {
  opacity: 0.6;
  font-weight: 500;
}
</style>
