import { z } from 'zod'

/**
 * Проверка форм входа и регистрации в браузере (Zod). Правила и тексты совпадают с проверкой на сервере
 * (`services/identity`, `lang/ru/validation.php`): ошибка видна сразу, без запроса. Сервер всё равно проверяет повторно.
 */
const required = (label: string) => `Заполните поле «${label}».`
const email = z
  .string()
  .trim()
  .min(1, required('электронная почта'))
  .max(254, 'Поле «электронная почта» не должно быть длиннее 254 символов.')
  .pipe(z.email('Поле «электронная почта» должно быть корректным адресом электронной почты.'))
const password = z
  .string()
  .min(1, 'Введите пароль.')
  .max(72, 'Пароль должен содержать не больше 72 символов.')
const newPassword = password.min(12, 'Пароль должен содержать не меньше 12 символов.')

export const loginSchema = z.object({ email, password })
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, required('имя'))
    .max(100, 'Имя не должно быть длиннее 100 символов.'),
  email,
  password: newPassword,
})
export const forgotSchema = z.object({ email })
export const resetSchema = z
  .object({ email, password: newPassword, password_confirmation: z.string() })
  .refine((value) => value.password === value.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Подтверждение пароля не совпадает.',
  })

/** Ошибки по полям в том же виде, что присылает сервер: `{ поле: [сообщения] }`; `null`, если всё в порядке. */
export function validateForm(schema: z.ZodType, values: unknown): Record<string, string[]> | null {
  const result = schema.safeParse(values)
  if (result.success) return null
  const fields: Record<string, string[]> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form')
    ;(fields[key] ??= []).push(issue.message)
  }
  return fields
}
