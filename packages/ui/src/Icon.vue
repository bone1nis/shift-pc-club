<script setup lang="ts">
import { computed } from 'vue'
import { icons, type IconName } from './icons/data'

const props = withDefaults(
  defineProps<{
    name: IconName
    /** Размер в `em`/`rem`: по умолчанию иконка равна размеру текста. */
    size?: string
    /** Толщина линии. */
    stroke?: number
    /** Подпись для скринридера; без неё иконка считается декоративной. */
    label?: string
  }>(),
  { size: '1em', stroke: 2, label: '' },
)
// Содержимое берётся из локального списка иконок (см. scripts/generate-icons.mjs), а не из пользовательского ввода.
const body = computed(() => icons[props.name])
</script>

<template>
  <svg
    class="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    :width="size"
    :height="size"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : true"
    focusable="false"
    v-html="body"
  />
</template>

<style scoped>
.icon {
  flex: none;
  vertical-align: -0.125em;
}
</style>
