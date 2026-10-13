import { describe, expect, it } from 'vitest'
import {
  availabilitySchema,
  bookingSchema,
  gamingSessionSchema,
  notificationSchema,
} from '../../packages/contracts/src/schemas'
import {
  loginSchema,
  registerSchema,
  resetSchema,
  validateForm,
} from '../../apps/web/src/features/authenticate/model/schemas'
import { apiParsed } from '../../apps/web/src/shared/api'

const booking = {
  id: 1,
  user_id: 3,
  status: 'confirmed',
  starts_at: '2026-10-15T15:30:00.000Z',
  ends_at: '2026-10-15T18:30:00.000Z',
  total_price: 54000,
  items: [{ id: 1, workstation_id: 4, hourly_price: 18000, price: 54000 }],
  created_at: '2026-10-13T10:00:00.000Z',
}

describe('auth form schemas', () => {
  it('registration returns Russian messages that match the server', () => {
    const fields = validateForm(registerSchema, {
      name: 'Игрок',
      email: 'not-an-email',
      password: 'short',
    })
    expect(fields?.password).toEqual(['Пароль должен содержать не меньше 12 символов.'])
    expect(fields?.email?.[0]).toMatch(/корректным адресом/)
    expect(fields?.name).toBeUndefined()
  })

  it('accepts valid registration and login data', () => {
    expect(
      validateForm(registerSchema, { name: 'Игрок', email: 'a@b.ru', password: 'ShiftDemo2026!' }),
    ).toBeNull()
    expect(validateForm(loginSchema, { email: ' a@b.ru ', password: 'x' })).toBeNull()
  })

  it('asks for empty fields and checks the password confirmation', () => {
    expect(validateForm(loginSchema, { email: '', password: '' })).toMatchObject({
      email: ['Заполните поле «электронная почта».'],
      password: ['Введите пароль.'],
    })
    const reset = validateForm(resetSchema, {
      email: 'a@b.ru',
      password: 'ShiftDemo2026!',
      password_confirmation: 'other',
    })
    expect(reset?.password_confirmation).toEqual(['Подтверждение пароля не совпадает.'])
  })
})

describe('API response schemas', () => {
  it('accepts a valid booking and drops unknown fields', () => {
    expect(bookingSchema.parse({ ...booking, extra: 1 })).toEqual(booking)
  })

  it('rejects a changed contract', () => {
    expect(bookingSchema.safeParse({ ...booking, status: 'paid' }).success).toBe(false)
    expect(bookingSchema.safeParse({ ...booking, total_price: '540' }).success).toBe(false)
    expect(availabilitySchema.safeParse({ workstation_id: 1 }).success).toBe(false)
  })

  it('allows nullable session fields', () => {
    const session = {
      id: 1,
      booking_id: null,
      user_id: null,
      workstation_id: 2,
      status: 'active',
      starts_at: 'a',
      ends_at: 'b',
      total_price: 1,
      ended_at: null,
      paid_at: null,
    }
    expect(gamingSessionSchema.safeParse(session).success).toBe(true)
  })

  it('apiParsed turns an unexpected response into a clear error', async () => {
    const original = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: [{ workstation_id: 'x' }] }), {
        status: 200,
      })) as typeof fetch
    try {
      await expect(
        apiParsed(availabilitySchema.array(), '/api/booking/availability'),
      ).rejects.toMatchObject({
        status: 502,
        message: expect.stringContaining('неожиданный ответ'),
      })
    } finally {
      globalThis.fetch = original
    }
  })
})

describe('notification schema', () => {
  it('принимает ответ API и отбрасывает служебные поля', () => {
    const row = {
      id: 7,
      type: 'booking.confirmed',
      data: { booking_id: 3 },
      delivery_status: 'sent',
      created_at: '2026-10-13T10:00:00Z',
      sent_at: null,
      dedupe_key: 'x',
      delivery_attempts: 1,
    }
    expect(notificationSchema.parse(row)).not.toHaveProperty('dedupe_key')
    expect(notificationSchema.safeParse({ ...row, id: '7' }).success).toBe(false)
  })
})
