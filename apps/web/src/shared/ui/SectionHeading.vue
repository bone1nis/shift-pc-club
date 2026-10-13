<script setup lang="ts">
import { vReveal } from './reveal'
defineProps<{ eyebrow: string }>()
</script>

<template>
  <div v-reveal class="section-heading">
    <div>
      <span class="section-heading__eyebrow">{{ eyebrow }}</span>
      <h2><slot name="title" /></h2>
    </div>
    <p class="section-heading__copy"><slot /></p>
  </div>
</template>

<style scoped>
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 48px;
  margin-bottom: 48px;
}
.section-heading__eyebrow {
  display: block;
  margin-bottom: 22px;
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--acid);
}
.section-heading__copy {
  font-size: var(--fs-14);
  color: var(--muted);
}
.section-heading :deep(.outline) {
  color: transparent;
  -webkit-text-stroke: 1px var(--olive-87);
}
@media (max-width: 760px) {
  .section-heading {
    display: block;
    margin-bottom: 32px;
  }
  .section-heading__copy {
    margin-top: 29px;
    font-size: var(--fs-13);
  }
}
</style>
