<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = defineProps<{ modelValue: boolean; title: string; description?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const titleId = useId()
const panel = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

const focusable = () =>
  Array.from(
    panel.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  )

function close() {
  emit('update:modelValue', false)
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close()
    return
  }
  if (event.key !== 'Tab') return
  const items = focusable()
  if (!items.length) return
  const first = items[0]!
  const last = items[items.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      await nextTick()
      ;(
        panel.value?.querySelector<HTMLElement>('[data-autofocus]') ??
        focusable()[0] ??
        panel.value
      )?.focus()
    } else {
      document.body.style.overflow = ''
      previouslyFocused?.focus()
    }
  },
)
onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="modelValue" class="dialog" @pointerdown.self="close">
        <div
          ref="panel"
          class="dialog__panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          @keydown="onKey"
        >
          <h2 :id="titleId" class="dialog__title">{{ title }}</h2>
          <p v-if="description" class="dialog__description">{{ description }}</p>
          <slot />
          <div v-if="$slots.actions" class="dialog__actions"><slot name="actions" /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog);
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--gray-3-a72);
}
.dialog__panel {
  width: min(100%, 480px);
  display: grid;
  gap: 18px;
  padding: 29px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow-pop);
  outline: none;
}
.dialog__title {
  font-family: var(--font-sans);
  font-size: var(--fs-22);
  line-height: 1.2;
  text-transform: none;
  letter-spacing: 0;
}
.dialog__description {
  color: var(--muted);
  font-size: var(--fs-14);
}
.dialog__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.18s ease;
}
.dialog-enter-active .dialog__panel,
.dialog-leave-active .dialog__panel {
  transition: transform 0.2s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from .dialog__panel,
.dialog-leave-to .dialog__panel {
  transform: translateY(14px) scale(0.98);
}
</style>
