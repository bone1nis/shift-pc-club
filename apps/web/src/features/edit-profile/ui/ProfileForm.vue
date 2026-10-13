<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiButton, UiField } from '@shift/ui'
import type { User } from '@shift/contracts'
import { useUserStore } from '@fsd/entities/user'
import { api, errorMessage } from '@fsd/shared/api'

const emit = defineEmits<{ saved: []; failed: [message: string] }>()
const store = useUserStore()
const name = ref(store.user?.name ?? '')
const pending = ref(false)
watch(
  () => store.user?.name,
  (value) => {
    if (value !== undefined) name.value = value
  },
)

async function save() {
  if (!name.value.trim() || pending.value) return
  pending.value = true
  try {
    store.user = await api<User>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ name: name.value.trim() }),
    })
    name.value = store.user.name
    emit('saved')
  } catch (cause) {
    emit('failed', errorMessage(cause))
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <form novalidate class="profile-form" @submit.prevent="save">
    <UiField id="profile-name" v-model="name" label="Имя" autocomplete="name" required />
    <p class="profile-form__email">{{ store.user?.email }}</p>
    <UiButton
      type="submit"
      variant="secondary"
      :loading="pending"
      :disabled="name.trim() === store.user?.name"
      >Сохранить имя</UiButton
    >
  </form>
</template>

<style scoped>
.profile-form {
  display: grid;
  gap: 21px;
}
.profile-form__email {
  font-size: var(--fs-13);
  color: var(--muted);
}
</style>
