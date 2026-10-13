<script setup lang="ts">
import { UiIcon } from '@shift/ui'
defineProps<{ to: string }>()
</script>

<template>
  <RouterLink :to="to" class="arrow-link"><slot /> <UiIcon name="arrow-up-right" /></RouterLink>
</template>

<style scoped>
.arrow-link {
  font-size: var(--fs-13);
  font-weight: 700;
  color: var(--acid);
  white-space: nowrap;
}
.arrow-link:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
</style>
