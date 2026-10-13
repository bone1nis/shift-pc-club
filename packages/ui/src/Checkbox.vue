<script setup lang="ts">
import Icon from './Icon.vue'
defineProps<{ modelValue: boolean; label?: string; disabled?: boolean }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <label class="checkbox" :class="{ 'checkbox--disabled': disabled }">
    <input
      class="checkbox__native"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="checkbox__box" aria-hidden="true">
      <Icon name="check" size="14px" :stroke="3" />
    </span>
    <span class="checkbox__label"
      ><slot>{{ label }}</slot></span
    >
  </label>
</template>

<style scoped>
.checkbox {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-size: var(--fs-14);
}
.checkbox--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.checkbox__native {
  position: absolute;
  opacity: 0;
  width: 22px;
  height: 22px;
  margin: 0;
}
.checkbox__box {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  background: var(--sunken);
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.checkbox__box svg {
  color: var(--acid-ink);
  opacity: 0;
}
.checkbox__native:checked + .checkbox__box {
  background: var(--acid);
  border-color: var(--acid);
}
.checkbox__native:checked + .checkbox__box svg {
  opacity: 1;
}
.checkbox:hover .checkbox__box {
  border-color: var(--acid);
}
.checkbox__native:focus-visible + .checkbox__box {
  outline: 2px solid var(--acid);
  outline-offset: 3px;
}
</style>
