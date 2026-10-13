<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'md' | 'sm'
    loading?: boolean
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    block?: boolean
    /** Рендерить как ссылку: 'a' или компонент роутера (например, NuxtLink / RouterLink). */
    as?: string | Component
  }>(),
  { variant: 'primary', size: 'md', type: 'button', loading: false, disabled: false, block: false },
)
</script>

<template>
  <component
    :is="as ?? 'button'"
    :type="as ? undefined : type"
    class="button"
    :class="[`button--${variant}`, `button--${size}`, { 'button--block': block }]"
    :disabled="as ? undefined : disabled || loading"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="button__spinner" aria-hidden="true"></span><slot />
  </component>
</template>

<style scoped>
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 11px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  min-height: 52px;
  padding: 14px 22px;
  font-size: var(--fs-14);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.045em;
  line-height: 1.2;
  text-align: center;
  transition:
    background 0.2s,
    border-color 0.2s,
    transform 0.2s;
}
.button--sm {
  min-height: 40px;
  padding: 8px 14px;
  font-size: var(--fs-12);
}
.button--block {
  display: flex;
  width: 100%;
}
.button :slotted(.icon) {
  transition: translate 0.25s ease;
}
.button:hover:not(:disabled) :slotted(.icon) {
  translate: 2px -2px;
}
.button:hover:not(:disabled) {
  transform: translateY(-2px);
}
.button--primary {
  background: var(--acid);
  color: var(--bg);
}
.button--secondary {
  background: var(--raised);
  border-color: var(--gray-28);
}
.button--secondary:hover:not(:disabled) {
  border-color: var(--acid);
}
.button--ghost {
  background: transparent;
  border-color: var(--line);
}
.button--ghost:hover:not(:disabled) {
  border-color: var(--acid);
}
.button--danger {
  background: var(--red-22);
  color: var(--red-89);
  border-color: var(--red-34);
}
.button:disabled {
  opacity: 0.5;
}
.button__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 700px) {
  .button {
    padding: 14px 16px;
  }
}
</style>
