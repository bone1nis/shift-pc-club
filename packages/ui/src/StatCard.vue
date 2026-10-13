<script setup lang="ts">
defineProps<{ label: string; value: string | number; hint?: string; suffix?: string }>()
</script>

<template>
  <article class="stat">
    <span class="stat__label">{{ label }}</span>
    <strong class="stat__value"
      >{{ value }}<small v-if="suffix"> {{ suffix }}</small></strong
    >
    <span v-if="hint" class="stat__hint">{{ hint }}</span>
  </article>
</template>

<style scoped>
.stat {
  animation: shift-rise 0.35s ease both;
  display: grid;
  gap: 10px;
  padding: 22px 24px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  min-width: 0;
}
.stat__label {
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--muted);
}
.stat__value {
  font-family: var(--font-display);
  font-size: var(--fs-48);
  line-height: 1;
  color: var(--acid);
}
.stat__value small {
  font-family: var(--font-sans);
  font-size: var(--fs-16);
  color: var(--muted);
  font-weight: 600;
}
.stat__hint {
  font-size: var(--fs-13);
}
@media (max-width: 520px) {
  .stat {
    padding: 14px 16px;
    gap: 6px;
  }
  .stat__label {
    font-size: var(--fs-10);
    letter-spacing: 0.1em;
  }
  .stat__value {
    font-size: var(--fs-36);
  }
  .stat__hint {
    font-size: var(--fs-12);
  }
}
</style>
