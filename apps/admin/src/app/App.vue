<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@fsd/entities/user'
import { canUseAdminPanel } from '@fsd/shared/lib'
import { AdminShell } from '@fsd/widgets/admin-shell'

const route = useRoute()
const user = useUserStore()
const isLogin = computed(() => route.path === '/login')
// Оболочка показывается только после проверки роли: иначе игрок или гость на мгновение видит интерфейс админки.
const allowed = computed(() => user.loaded && canUseAdminPanel(user.user?.role))
</script>

<template>
  <RouterView v-if="isLogin" />
  <AdminShell v-else-if="allowed" />
</template>
