<script setup lang="ts">
defineProps<{ loading?: boolean }>()
</script>

<template>
  <div class="legend">
    <span><i class="legend__free"></i>Свободно</span>
    <span><i class="legend__selected"></i>Выбрано</span>
    <span><i class="legend__busy"></i>Недоступно</span>
    <span v-if="loading" role="status">Обновляем доступность…</span>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
  font-size: var(--fs-10);
  color: var(--muted);
}
.legend i {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 6px;
  border-radius: 2px;
}
.legend__free {
  background: var(--olive-30);
}
.legend__selected {
  background: var(--acid);
}
.legend__busy {
  background: var(--gray-31);
}
@media (max-width: 760px) {
  .legend {
    gap: 13px;
  }
}
</style>
