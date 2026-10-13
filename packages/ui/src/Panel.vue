<script setup lang="ts">
defineProps<{ eyebrow?: string; title?: string }>()
</script>

<template>
  <section class="panel">
    <header v-if="eyebrow || title || $slots.actions" class="panel__header">
      <div>
        <span v-if="eyebrow" class="panel__eyebrow">{{ eyebrow }}</span>
        <h2 v-if="title" class="panel__title">{{ title }}</h2>
      </div>
      <div v-if="$slots.actions" class="panel__actions"><slot name="actions" /></div>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.panel {
  animation: shift-rise 0.35s ease both;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 29px;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 21px;
  align-content: start;
}
.panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}
.panel__eyebrow {
  display: block;
  margin-bottom: 11px;
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--acid);
}
.panel__title {
  font-family: var(--font-sans);
  font-size: var(--fs-22);
  line-height: 1.2;
  text-transform: none;
  letter-spacing: 0;
}
.panel__actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
@media (max-width: 700px) {
  .panel {
    padding: 19px;
  }
  .panel__header {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .panel__header > * {
    min-width: 0;
  }
  /* Действия в шапке панели занимают всю строку: поля и кнопки не сжимаются. */
  .panel__actions {
    flex: 1 1 100%;
    flex-wrap: wrap;
  }
  .panel__actions > * {
    flex: 1 1 auto;
  }
}
</style>
