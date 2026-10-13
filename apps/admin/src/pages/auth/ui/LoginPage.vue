<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { UiButton, UiField, UiIcon, UiLogo, UiNotice, UiPanel } from '@shift/ui'
import { useUserStore } from '@fsd/entities/user'
import { ApiFailure, errorMessage } from '@fsd/shared/api'

const user = useUserStore()
const router = useRouter()
const email = ref('')
const password = ref('')
const pending = ref(false)
const error = ref('')
const fields = ref<Record<string, string[]>>({})

async function login() {
  if (pending.value) return
  pending.value = true
  error.value = ''
  fields.value = {}
  try {
    await user.signIn(email.value, password.value)
    if (user.user?.role !== 'admin') {
      error.value = 'Для панели нужны права администратора.'
      return
    }
    const requested = new URLSearchParams(window.location.search).get('next') ?? ''
    const target = requested.startsWith('/admin/') ? requested.slice('/admin'.length) : '/'
    await router.push(target.startsWith('//') || target === '/login' ? '/' : target)
  } catch (e) {
    error.value = errorMessage(e)
    if (e instanceof ApiFailure) fields.value = e.fields
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <main class="login">
    <UiPanel class="login__panel">
      <form novalidate class="login__form" @submit.prevent="login">
        <a href="/" aria-label="SHIFT — открыть сайт"><UiLogo /></a>
        <span class="login__eyebrow">Club control</span>
        <h1>Вход на смену</h1>
        <p class="login__hint">Управление игровым залом для администраторов клуба.</p>
        <UiField
          id="email"
          v-model="email"
          type="email"
          label="Электронная почта"
          autocomplete="email"
          required
          :error="fields.email?.[0]"
        />
        <UiField
          id="password"
          v-model="password"
          type="password"
          label="Пароль"
          autocomplete="current-password"
          required
          :error="fields.password?.[0]"
        />
        <UiNotice v-if="error" tone="error">{{ error }}</UiNotice>
        <UiButton type="submit" :loading="pending"
          >Начать смену <UiIcon name="arrow-up-right"
        /></UiButton>
      </form>
    </UiPanel>
  </main>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 16px;
}
.login__panel {
  width: min(100%, 448px);
}
.login__form {
  display: grid;
  gap: 21px;
}
.login__eyebrow {
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--acid);
}
.login h1 {
  font-size: var(--fs-48);
}
.login__hint {
  font-size: var(--fs-13);
  color: var(--muted);
}
</style>
