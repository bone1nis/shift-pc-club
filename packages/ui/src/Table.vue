<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Таблица' })
</script>

<template>
  <div class="table-wrap" tabindex="0" role="region" :aria-label="label">
    <table class="table">
      <slot />
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  /* Контейнер позиционирования: скрытые подписи (.sr-only) не должны расширять страницу. */
  position: relative;
  overflow: auto;
  max-width: 100%;
}
.table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.table :deep(th) {
  color: var(--muted);
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  padding: 16px;
  white-space: nowrap;
}
.table :deep(td) {
  border-top: 1px solid var(--line);
  padding: 16px;
  font-size: var(--fs-14);
  vertical-align: middle;
}
/* На телефоне таблица не сжимается до нечитаемых колонок, а прокручивается внутри своего блока. */
@media (max-width: 760px) {
  .table {
    min-width: 640px;
  }
  .table :deep(th),
  .table :deep(td) {
    padding: 12px;
  }
  /* Даты и короткие значения не разрываются на строки; длинный текст ячейка может сама разрешить переносом (white-space: normal). */
  .table :deep(td) {
    white-space: nowrap;
  }
}
</style>
