<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { AdminShell } from '@fsd/widgets/admin-shell'

const route = useRoute()
const isLogin = computed(() => route.path === '/login')
</script>

<template>
  <RouterView v-if="isLogin" />
  <AdminShell v-else />
</template>
