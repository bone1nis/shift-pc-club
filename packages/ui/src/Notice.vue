<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'info' | 'error' }>(), { tone: 'info' })
</script>

<template>
  <div class="notice" :class="`notice--${tone}`" :role="tone === 'error' ? 'alert' : 'status'">
    <slot />
  </div>
</template>

<style scoped>
.notice {
  animation: shift-rise 0.35s ease both;
  padding: 16px 19px;
  background: var(--notice-bg);
  border: 1px solid var(--notice-line);
  color: var(--notice-text);
  border-radius: 6px;
  font-size: var(--fs-14);
  line-height: 1.5;
}
.notice--error {
  background: var(--danger-bg);
  border-color: var(--danger-line);
  color: var(--red-88);
}
</style>
