<script setup lang="ts">
import { ref } from 'vue'

export interface TabOption {
  value: string | number
  label: string
  hint?: string
}
const props = withDefaults(
  defineProps<{
    modelValue: string | number
    options: TabOption[]
    label?: string
    variant?: 'underline' | 'pills'
  }>(),
  { variant: 'underline' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()
const list = ref<HTMLElement | null>(null)

function onKey(event: KeyboardEvent, index: number) {
  const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key as 'ArrowRight']
  if (!delta) return
  event.preventDefault()
  const next = (index + delta + props.options.length) % props.options.length
  emit('update:modelValue', props.options[next]!.value)
  list.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
}
</script>

<template>
  <div ref="list" class="tabs" :class="`tabs--${variant}`" role="tablist" :aria-label="label">
    <button
      v-for="(option, index) in options"
      :key="option.value"
      type="button"
      role="tab"
      class="tabs__tab"
      :class="{ 'tabs__tab--active': option.value === modelValue }"
      :aria-selected="option.value === modelValue"
      :tabindex="option.value === modelValue ? 0 : -1"
      @click="$emit('update:modelValue', option.value)"
      @keydown="onKey($event, index)"
    >
      {{ option.label }}<span v-if="option.hint" class="tabs__hint"> / {{ option.hint }}</span>
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-wrap: wrap;
}
.tabs__tab {
  background: none;
  border: 0;
  color: var(--muted);
  font-size: var(--fs-14);
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}
.tabs__hint {
  opacity: 0.7;
}
.tabs--underline {
  border-bottom: 1px solid var(--line);
  gap: 32px;
}
.tabs--underline .tabs__tab {
  padding: 16px 0;
  border-bottom: 2px solid transparent;
}
.tabs--underline .tabs__tab--active {
  border-color: var(--acid);
  color: var(--acid);
}
.tabs--pills {
  gap: 10px;
}
.tabs--pills .tabs__tab {
  min-width: 0;
  max-width: 100%;
  padding: 11px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-size: var(--fs-12);
}
.tabs--pills .tabs__tab:hover {
  border-color: var(--acid);
}
.tabs--pills .tabs__tab--active {
  background: var(--acid);
  border-color: var(--acid);
  color: var(--acid-ink);
}
</style>
