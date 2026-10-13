import { computed, ref } from 'vue'
import { navigateTo, useRoute } from '#imports'
import { useUserStore } from '@fsd/entities/user'
import { api, ApiFailure, errorMessage } from '@fsd/shared/api'
import { forgotSchema, loginSchema, registerSchema, resetSchema, validateForm } from './schemas'

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

/** Безопасный путь возврата после входа: только внутренние пути сайта. */
export function safeNext(value: unknown, fallback = '/account'): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : fallback
}

export function useAuthForm() {
  const route = useRoute()
  const user = useUserStore()
  const mode = ref<AuthMode>(
    typeof route.query.token === 'string' && typeof route.query.email === 'string'
      ? 'reset'
      : 'login',
  )
  const name = ref('')
  const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
  const password = ref('')
  const confirmation = ref('')
  const message = ref('')
  const error = ref('')
  const pending = ref(false)
  const fields = ref<Record<string, string[]>>({})

  const isTabbed = computed(() => mode.value === 'login' || mode.value === 'register')

  function clearFeedback() {
    error.value = ''
    message.value = ''
    fields.value = {}
  }
  function setMode(next: AuthMode) {
    mode.value = next
    clearFeedback()
  }

  /** Проверка введённых данных до запроса: понятные ошибки по полям сразу, без обращения к серверу. */
  function validate(): boolean {
    const values = {
      name: name.value,
      email: email.value,
      password: password.value,
      password_confirmation: confirmation.value,
    }
    const schema = {
      login: loginSchema,
      register: registerSchema,
      forgot: forgotSchema,
      reset: resetSchema,
    }[mode.value]
    const problems = validateForm(schema, values)
    if (problems) fields.value = problems
    return !problems
  }

  async function submit() {
    if (pending.value) return
    clearFeedback()
    if (!validate()) return
    pending.value = true
    try {
      if (mode.value === 'forgot') {
        const result = await api<{ message: string }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: email.value }),
        })
        message.value = result.message
        return
      }
      if (mode.value === 'reset') {
        await api('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({
            email: email.value,
            token: route.query.token,
            password: password.value,
            password_confirmation: confirmation.value,
          }),
        })
        setMode('login')
        message.value = 'Пароль изменён. Теперь можно войти.'
        return
      }
      if (mode.value === 'register') await user.register(name.value, email.value, password.value)
      else await user.signIn(email.value, password.value)
      await navigateTo(safeNext(route.query.next))
    } catch (e) {
      error.value = errorMessage(e)
      if (e instanceof ApiFailure) fields.value = e.fields
    } finally {
      pending.value = false
    }
  }

  return {
    mode,
    name,
    email,
    password,
    confirmation,
    message,
    error,
    pending,
    fields,
    isTabbed,
    setMode,
    submit,
  }
}
