<script setup lang="ts">
import { onMounted } from 'vue'
import { ownerChannel } from '@shift/contracts'
import { useRealtimeChannel } from '@shift/ui'
import { newComplaints, refreshNewComplaints } from '@fsd/shared/lib'

// Рендерится только для владельца: подписку на private-owner администратору сервер всё равно не разрешит.
useRealtimeChannel(ownerChannel, '.complaint.created', () => void refreshNewComplaints())
onMounted(refreshNewComplaints)
</script>

<template>
  <span v-if="newComplaints > 0" class="badge"
    ><span aria-hidden="true">{{ newComplaints }}</span
    ><span class="sr-only"> новых: {{ newComplaints }}</span></span
  >
</template>

<style scoped>
.badge {
  margin-left: auto;
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--acid);
  color: var(--black, #000);
  font-size: var(--fs-11);
  font-weight: 700;
  text-align: center;
}
</style>
