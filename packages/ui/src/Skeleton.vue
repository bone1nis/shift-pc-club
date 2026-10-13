<script setup lang="ts">
/** Заглушка на время загрузки: мерцающий блок нужного размера, чтобы страница не «прыгала» при появлении данных. */
withDefaults(
  defineProps<{
    width?: string
    height?: string
    /** `circle` — круг (аватар), `text` — строка текста. */
    shape?: 'block' | 'circle' | 'text'
  }>(),
  { width: '100%', height: '1em', shape: 'block' },
)
</script>

<template>
  <span
    class="skeleton"
    :class="`skeleton--${shape}`"
    :style="{ width, height }"
    aria-hidden="true"
  ></span>
</template>

<style scoped>
.skeleton {
  display: inline-block;
  vertical-align: middle;
  background: linear-gradient(100deg, var(--raised) 30%, var(--line-strong) 50%, var(--raised) 70%);
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}
.skeleton--circle {
  border-radius: 50%;
}
.skeleton--text {
  border-radius: 6px;
}
@keyframes skeleton-shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
</style>
