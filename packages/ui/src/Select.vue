<script setup lang="ts">
import Icon from './Icon.vue'
import { computed, nextTick, ref, useId, watch } from 'vue'
import { usePopover } from './lib/popover'

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null
    options: SelectOption[]
    label: string
    id?: string
    placeholder?: string
    error?: string
    required?: boolean
    disabled?: boolean
  }>(),
  { placeholder: 'Выберите', error: '', required: false, disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()

const generated = useId()
const baseId = computed(() => props.id ?? generated)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { open, style, toggle, close, openPanel } = usePopover({ trigger, panel })
const active = ref(-1)

const selected = computed(() => props.options.find((option) => option.value === props.modelValue))
const enabled = computed(() =>
  props.options.map((option, index) => (option.disabled ? -1 : index)).filter((i) => i >= 0),
)

watch(open, async (value) => {
  if (!value) return
  const current = props.options.findIndex((option) => option.value === props.modelValue)
  active.value = current >= 0 ? current : (enabled.value[0] ?? -1)
  await nextTick()
  panel.value?.focus({ preventScroll: true })
})

function move(step: number) {
  const list = enabled.value
  if (!list.length) return
  const position = list.indexOf(active.value)
  const next = position < 0 ? 0 : (position + step + list.length) % list.length
  active.value = list[next]!
  void nextTick(() =>
    document
      .getElementById(`${baseId.value}-opt-${active.value}`)
      ?.scrollIntoView?.({ block: 'nearest' }),
  )
}
function choose(index: number) {
  const option = props.options[index]
  if (!option || option.disabled) return
  emit('update:modelValue', option.value)
  close(true)
}
function onTriggerKey(event: KeyboardEvent) {
  if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault()
    openPanel()
  }
}
function onPanelKey(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'Home':
      event.preventDefault()
      active.value = enabled.value[0] ?? -1
      break
    case 'End':
      event.preventDefault()
      active.value = enabled.value[enabled.value.length - 1] ?? -1
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      choose(active.value)
      break
    case 'Tab':
      close(false)
      break
  }
}
</script>

<template>
  <div class="select">
    <span :id="`${baseId}-label`" class="select__label">{{ label }}</span>
    <button
      :id="baseId"
      ref="trigger"
      type="button"
      class="select__trigger"
      :class="{ 'select__trigger--placeholder': !selected }"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-labelledby="`${baseId}-label ${baseId}`"
      :data-invalid="!!error || undefined"
      :aria-describedby="error ? `${baseId}-error` : undefined"
      @click="toggle"
      @keydown="onTriggerKey"
    >
      <span class="select__value">{{ selected?.label ?? placeholder }}</span>
      <Icon class="select__chevron" name="chevron-down" size="16px" :stroke="2" />
    </button>
    <p v-if="error" :id="`${baseId}-error`" class="select__error">{{ error }}</p>
    <Teleport to="body">
      <Transition name="pop">
        <ul
          v-if="open"
          ref="panel"
          class="select__panel"
          :style="style"
          role="listbox"
          tabindex="-1"
          :aria-labelledby="`${baseId}-label`"
          :aria-activedescendant="active >= 0 ? `${baseId}-opt-${active}` : undefined"
          @keydown="onPanelKey"
        >
          <li
            v-for="(option, index) in options"
            :id="`${baseId}-opt-${index}`"
            :key="option.value"
            class="select__option"
            :class="{
              'select__option--active': index === active,
              'select__option--selected': option.value === modelValue,
              'select__option--disabled': option.disabled,
            }"
            role="option"
            :aria-selected="option.value === modelValue"
            :aria-disabled="option.disabled || undefined"
            @pointerenter="!option.disabled && (active = index)"
            @click="choose(index)"
          >
            {{ option.label }}
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.select {
  display: grid;
  gap: 10px;
  min-width: 0;
}
.select__label {
  font-size: var(--fs-13);
  font-weight: 600;
}
.select__trigger {
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
.select__trigger:hover:not(:disabled) {
  border-color: var(--gray-41);
}
.select__trigger[aria-expanded='true'],
.select__trigger:focus-visible {
  border-color: var(--acid);
  outline: none;
}
.select__trigger[data-invalid='true'] {
  border-color: var(--danger);
}
.select__trigger:disabled {
  opacity: 0.55;
}
.select__trigger--placeholder .select__value {
  color: var(--gray-42);
}
.select__value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.select__chevron {
  color: var(--acid);
  transition: transform 0.2s;
}
.select__trigger[aria-expanded='true'] .select__chevron {
  transform: rotate(180deg);
}
.select__error {
  color: var(--danger);
  font-size: var(--fs-14);
}
.select__panel {
  position: fixed;
  top: 0;
  left: 0;
  z-index: var(--z-popover);
  margin: 0;
  padding: 6px;
  max-height: 256px;
  overflow: auto;
  list-style: none;
  background: var(--raised);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  box-shadow: var(--shadow-pop);
  outline: none;
}
.select__option {
  padding: 11px 13px;
  border-radius: 4px;
  font-size: var(--fs-14);
  cursor: pointer;
}
.select__option--active {
  background: var(--gray-19);
}
.select__option--selected {
  color: var(--acid);
  font-weight: 700;
}
.select__option--disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
