<script setup lang="ts">
import { computed } from 'vue'
import { UiButton, UiField, UiIcon, UiNotice, UiTabs } from '@shift/ui'
import { useAuthForm, type AuthMode } from '../model/useAuthForm'

const form = useAuthForm()
const { mode, fields } = form

const copy: Record<AuthMode, { title: string; hint: string; submit: string }> = {
  login: {
    title: 'С возвращением',
    hint: 'Войди, чтобы продолжить с того же уровня.',
    submit: 'Войти в SHIFT',
  },
  register: {
    title: 'Начни свою историю',
    hint: 'Создай аккаунт и выбери своё место в SHIFT.',
    submit: 'Создать аккаунт',
  },
  forgot: {
    title: 'Восстановить доступ',
    hint: 'Если аккаунт существует, мы отправим инструкции на почту.',
    submit: 'Отправить инструкции',
  },
  reset: {
    title: 'Новый пароль',
    hint: 'Придумай новый пароль длиной не менее 12 символов.',
    submit: 'Сохранить пароль',
  },
}
const current = computed(() => copy[mode.value])
const tabs = [
  { value: 'login', label: 'Вход' },
  { value: 'register', label: 'Регистрация' },
]
</script>

<template>
  <div class="auth-form">
    <UiTabs
      v-if="form.isTabbed.value"
      class="auth-form__tabs"
      :model-value="mode"
      :options="tabs"
      label="Режим"
      @update:model-value="form.setMode($event as AuthMode)"
    />
    <form novalidate class="auth-form__body" @submit.prevent="form.submit">
      <h2 class="auth-form__title">{{ current.title }}</h2>
      <p class="auth-form__hint">{{ current.hint }}</p>
      <UiField
        v-if="mode === 'register'"
        id="name"
        v-model="form.name.value"
        label="Имя"
        autocomplete="name"
        required
        :error="fields.name?.[0]"
      />
      <UiField
        v-if="mode !== 'reset'"
        id="email"
        v-model="form.email.value"
        type="email"
        label="Электронная почта"
        autocomplete="email"
        required
        :error="fields.email?.[0]"
      />
      <UiField
        v-if="mode !== 'forgot'"
        id="password"
        v-model="form.password.value"
        type="password"
        label="Пароль"
        :autocomplete="
          mode === 'register' || mode === 'reset' ? 'new-password' : 'current-password'
        "
        required
        :error="fields.password?.[0]"
      />
      <UiField
        v-if="mode === 'reset'"
        id="confirmation"
        v-model="form.confirmation.value"
        type="password"
        label="Повтори пароль"
        autocomplete="new-password"
        required
        :error="fields.password_confirmation?.[0]"
      />
      <UiNotice v-if="form.message.value">{{ form.message.value }}</UiNotice>
      <UiNotice v-if="form.error.value" tone="error">{{ form.error.value }}</UiNotice>
      <UiButton type="submit" :loading="form.pending.value"
        >{{ current.submit }} <UiIcon name="arrow-up-right"
      /></UiButton>
      <button
        v-if="mode === 'login'"
        class="auth-form__link"
        type="button"
        @click="form.setMode('forgot')"
      >
        Забыли пароль?
      </button>
      <button
        v-if="mode === 'forgot' || mode === 'reset'"
        class="auth-form__link"
        type="button"
        @click="form.setMode('login')"
      >
        Вернуться ко входу
      </button>
      <p class="auth-form__demo">
        Это локальная демонстрация клуба. Не используйте реальные персональные данные.
      </p>
    </form>
  </div>
</template>

<style scoped>
.auth-form {
  max-width: 432px;
  width: 100%;
  padding: 32px 0;
}
.auth-form__tabs {
  margin-bottom: 32px;
}
.auth-form__body {
  display: grid;
  gap: 21px;
}
.auth-form__title {
  font-size: var(--fs-40);
}
.auth-form__hint,
.auth-form__demo {
  font-size: var(--fs-13);
  color: var(--muted);
}
.auth-form__link {
  justify-self: start;
  padding: 0;
  background: none;
  border: 0;
  color: var(--muted);
  font-size: var(--fs-13);
  text-decoration: underline;
  text-underline-offset: 4px;
}
.auth-form__link:hover {
  color: var(--acid);
}
@media (max-width: 760px) {
  .auth-form {
    max-width: 100%;
    padding: 16px 0;
  }
}
</style>
