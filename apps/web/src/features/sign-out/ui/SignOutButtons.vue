<script setup lang="ts">
import { ref } from 'vue'
import { navigateTo } from '#imports'
import { UiButton } from '@shift/ui'
import { useUserStore } from '@fsd/entities/user'
import { api, errorMessage } from '@fsd/shared/api'

const emit = defineEmits<{ failed: [message: string] }>()
const store = useUserStore()
const pending = ref(false)

async function everywhere() {
  pending.value = true
  try {
    await api('/api/auth/logout-all', { method: 'POST' })
    store.user = null
    await navigateTo('/auth')
  } catch (cause) {
    emit('failed', errorMessage(cause))
  } finally {
    pending.value = false
  }
}
async function here() {
  pending.value = true
  try {
    await store.logout()
    await navigateTo('/')
  } catch (cause) {
    emit('failed', errorMessage(cause))
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="sign-out">
    <UiButton variant="danger" :loading="pending" @click="everywhere"
      >Выйти на всех устройствах</UiButton
    >
    <UiButton variant="ghost" :disabled="pending" @click="here">Выйти из аккаунта</UiButton>
  </div>
</template>

<style scoped>
.sign-out {
  display: grid;
  gap: 12px;
}
</style>
