<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'success' | 'warning' | 'neutral' | 'danger' }>(), {
  tone: 'neutral',
})
</script>

<template>
  <span class="status" :class="`status--${tone}`"
    ><span class="status__dot" aria-hidden="true"></span><slot
  /></span>
</template>

<style scoped>
.status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--line);
  border-radius: 32px;
  padding: 6px 11px;
  font-size: var(--fs-11);
  font-weight: 700;
  white-space: nowrap;
}
.status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.status--success {
  color: var(--acid);
  background: var(--success-bg);
}
.status--warning {
  color: var(--warning);
  background: var(--warning-bg);
}
.status--danger {
  color: var(--danger);
  background: var(--red-17);
}
.status--neutral {
  color: var(--muted);
}
</style>
