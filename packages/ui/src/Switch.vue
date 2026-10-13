<script setup lang="ts">
defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button
    type="button"
    class="switch"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
    <span class="switch__label">{{ label }}</span>
  </button>
</template>

<style scoped>
.switch {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  background: none;
  border: 0;
  font-size: var(--fs-14);
}
.switch:disabled {
  opacity: 0.5;
}
.switch__track {
  position: relative;
  width: 42px;
  height: 24px;
  flex: none;
  background: var(--raised);
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  transition: background 0.2s;
}
.switch__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  background: var(--muted);
  border-radius: 50%;
  transition:
    transform 0.2s,
    background 0.2s;
}
.switch[aria-checked='true'] .switch__track {
  background: var(--success-bg);
  border-color: var(--acid);
}
.switch[aria-checked='true'] .switch__thumb {
  transform: translateX(18px);
  background: var(--acid);
}
</style>
