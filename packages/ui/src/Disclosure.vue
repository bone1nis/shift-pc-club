<script setup lang="ts">
import Icon from './Icon.vue'
import { useId } from 'vue'

const open = defineModel<boolean>({ default: false })
defineProps<{ title: string }>()
const id = useId()
</script>

<template>
  <div class="disclosure" :class="{ 'disclosure--open': open }">
    <h3 class="disclosure__heading">
      <button
        :id="`${id}-button`"
        type="button"
        class="disclosure__button"
        :aria-expanded="open"
        :aria-controls="`${id}-panel`"
        @click="open = !open"
      >
        <span>{{ title }}</span>
        <Icon class="disclosure__icon" name="plus" size="16px" :stroke="2" />
      </button>
    </h3>
    <div
      :id="`${id}-panel`"
      class="disclosure__panel"
      role="region"
      :aria-labelledby="`${id}-button`"
      :inert="open ? undefined : true"
    >
      <div class="disclosure__inner"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.disclosure {
  border-top: 1px solid var(--line);
}
.disclosure:last-child {
  border-bottom: 1px solid var(--line);
}
.disclosure__heading {
  margin: 0;
  font-size: var(--fs-16);
}
.disclosure__button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
  padding: 21px 0;
  background: none;
  border: 0;
  text-align: left;
  font-size: var(--fs-16);
  font-weight: 600;
}
.disclosure__button:hover {
  color: var(--acid);
}
.disclosure__icon {
  color: var(--acid);
  transition: transform 0.2s;
}
.disclosure--open .disclosure__icon {
  transform: rotate(45deg);
}
.disclosure__panel {
  display: grid;
  grid-template-rows: 0fr;
  visibility: hidden;
  max-width: 736px;
  color: var(--muted);
  font-size: var(--fs-14);
  line-height: 1.65;
  transition:
    grid-template-rows 0.25s ease,
    visibility 0.25s;
}
.disclosure--open .disclosure__panel {
  grid-template-rows: 1fr;
  visibility: visible;
}
.disclosure__inner {
  min-height: 0;
  overflow: hidden;
}
.disclosure--open .disclosure__inner {
  padding-bottom: 22px;
}
</style>
