import type { ZodType } from 'zod'
import type { ApiResponse, ApiError } from '@shift/contracts'
export class ApiFailure extends Error {
  constructor(
    public status: number,
    public fields: Record<string, string[]> = {},
    message = 'Не удалось выполнить запрос',
  ) {
    super(message)
  }
}
let refreshing: Promise<void> | undefined
let bootstrapping: Promise<string> | undefined
const publicAuth = new Set([
  '/api/auth/csrf',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
])
function csrfCookie(): string {
  if (typeof document === 'undefined') return ''
  const value = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
    ?.slice('XSRF-TOKEN='.length)
  return value ? decodeURIComponent(value) : ''
}
async function csrf(force = false): Promise<string> {
  const current = force ? '' : csrfCookie()
  if (current) return current
  bootstrapping ??= (async () => {
    const run = async () => {
      // Пока эта вкладка ждала блокировку, другая вкладка могла уже получить CSRF-токен.
      const existing = force ? '' : csrfCookie()
      if (existing) return existing
      const response = await fetch('/api/auth/csrf', { credentials: 'include' })
      if (!response.ok) throw new ApiFailure(response.status, {}, 'Сервис авторизации недоступен')
      const result = (await response.json()) as ApiResponse<{ csrf_token: string }>
      return csrfCookie() || result.data.csrf_token
    }
    if (typeof navigator !== 'undefined' && navigator.locks)
      return navigator.locks.request('shift-auth-csrf', run)
    return run()
  })().finally(() => {
    bootstrapping = undefined
  })
  return bootstrapping
}
async function refresh(): Promise<void> {
  const run = async () => {
    // Ротацию пропускаем, если другая вкладка уже обновила общую cookie доступа.
    const current = await fetch('/api/auth/me', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (current.ok) return
    if (current.status !== 401) throw new ApiFailure(current.status)
    try {
      await api('/api/auth/refresh', { method: 'POST' }, false)
    } catch (e) {
      if (!(e instanceof ApiFailure) || e.status !== 409) throw e
      // В браузерах без Web Locks вкладки могут столкнуться: даём выигравшему ответу установить cookie,
      // а исходный запрос повторяется один раз и остаётся главным.
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  if (typeof navigator !== 'undefined' && navigator.locks)
    await navigator.locks.request('shift-auth-refresh', run)
  else await run()
}
const LOGIN_PATH = '/auth'
function sessionExpired(path: string): void {
  if (typeof window === 'undefined' || path === '/api/auth/me' || publicAuth.has(path)) return
  const here = window.location.pathname
  if (here === LOGIN_PATH || here === LOGIN_PATH + '/') return
  // Сессия истекла посреди работы: отправляем на вход и после входа возвращаем на прежнюю страницу.
  const next = window.location.pathname + window.location.search
  window.location.assign(LOGIN_PATH + '?next=' + encodeURIComponent(next))
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
  refreshCsrf = false,
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  if (options.method && options.method !== 'GET')
    headers.set('X-CSRF-TOKEN', await csrf(refreshCsrf))
  const response = await fetch(path, { ...options, headers, credentials: 'include' })
  if (response.status === 419 && !refreshCsrf && options.method && options.method !== 'GET') {
    // Токен в cookie мог устареть после действий в другой вкладке или смены сессии: обновляем его один раз и повторяем запрос.
    return api<T>(path, options, retry, true)
  }
  if (response.status === 401 && retry && !publicAuth.has(path)) {
    refreshing ??= refresh().finally(() => {
      refreshing = undefined
    })
    try {
      await refreshing
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 401) sessionExpired(path)
      throw e
    }
    return api<T>(path, options, false)
  }
  if (response.status === 401) sessionExpired(path)
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiError
    throw new ApiFailure(
      response.status,
      error.errors,
      error.message || 'Сервис временно недоступен. Попробуйте ещё раз.',
    )
  }
  if (response.status === 204) return undefined as T
  return ((await response.json()) as ApiResponse<T>).data
}
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Ошибка соединения. Проверьте доступность сервера.'
}
/**
 * Запрос с проверкой формы ответа по схеме Zod. Если сервер вернул не то, что ждёт интерфейс
 * (например, после изменения контракта), пользователь видит понятную ошибку, а не «undefined» на экране.
 */
export async function apiParsed<T>(
  schema: ZodType<T>,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const data = await api<unknown>(path, options)
  const result = schema.safeParse(data)
  if (!result.success) {
    console.error('Ответ API не соответствует контракту', path, result.error.issues)
    throw new ApiFailure(
      502,
      {},
      'Сервер вернул неожиданный ответ. Обновите страницу или повторите позже.',
    )
  }
  return result.data
}
