import { expect, test, type BrowserContext } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

// Реальный локальный стенд. Кабинет подписан на private-user.{id}: отмена брони из админ-API
// должна появиться на открытой странице без перезагрузки и раньше, чем сработает фолбэк-опрос (120 с).
test.describe.configure({ retries: 0 })

test('account updates without reload after admin cancels the booking', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(3 * 60_000)
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(new URL(baseURL!).hostname)
  const player = await browser.newContext({ baseURL, timezoneId: 'Europe/Moscow' })
  const admin = await browser.newContext({ baseURL, timezoneId: 'Europe/Moscow' })
  const page = await player.newPage()
  const adminPage = await admin.newPage()
  let bookingId: number | undefined
  let cancelled = false

  async function csrf(context: BrowserContext) {
    const cookie = (await context.cookies(baseURL!)).find((c) => c.name === 'XSRF-TOKEN')
    expect(cookie, 'CSRF cookie').toBeTruthy()
    return {
      Origin: new URL(baseURL!).origin,
      'X-CSRF-TOKEN': decodeURIComponent(cookie!.value),
    }
  }

  try {
    await adminPage.goto('/admin/login', { waitUntil: 'domcontentloaded' })
    await waitForInteractive(adminPage)
    await adminPage.getByLabel('Электронная почта').fill('admin@shift.local')
    await adminPage.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
    await adminPage.getByRole('button', { name: /Начать смену/ }).click()
    await expect(adminPage).toHaveURL(/\/admin\/$/)

    await page.goto('/auth?next=/account', { waitUntil: 'domcontentloaded' })
    await waitForInteractive(page)
    await page.getByLabel('Электронная почта').fill('player@shift.local')
    await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
    await page.getByRole('button', { name: /Войти в SHIFT/ }).click()
    // /auth?next=/account тоже оканчивается на /account, поэтому проверяем именно путь.
    await page.waitForURL((url) => url.pathname === '/account')

    // Бронь на завтра: не пересекается с текущим залом. Берём первое свободное место.
    const halfHour = 30 * 60_000
    const catalog = (await (await player.request.get('/api/club/catalog')).json()).data as {
      workstations: { id: number }[]
    }
    const base = Math.ceil((Date.now() + 24 * 3_600_000) / halfHour) * halfHour
    let startsAt = base
    let workstationId: number | undefined
    for (let shift = 0; shift < 12 && workstationId === undefined; shift += 1) {
      startsAt = base + shift * 2 * 3_600_000
      const free = (
        await (
          await player.request.get('/api/booking/availability', {
            params: {
              starts_at: new Date(startsAt).toISOString(),
              ends_at: new Date(startsAt + 3_600_000).toISOString(),
            },
          })
        ).json()
      ).data as { workstation_id: number; available: boolean }[]
      workstationId = catalog.workstations.find((w) =>
        free.some((a) => a.workstation_id === w.id && a.available),
      )?.id
    }
    expect(workstationId, 'Нужно одно свободное место на завтра').toBeTruthy()

    const created = await player.request.post('/api/booking/bookings', {
      headers: { ...(await csrf(player)), 'Idempotency-Key': crypto.randomUUID() },
      data: {
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(startsAt + 3_600_000).toISOString(),
        workstation_ids: [workstationId],
      },
    })
    expect(created.status()).toBe(201)
    bookingId = ((await created.json()).data as { id: number }).id

    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForInteractive(page)
    const card = page.locator('.booking-card').filter({ hasText: `Бронь #${bookingId}` })
    await expect(card).toBeVisible()
    await expect(card.getByText('Подтверждена', { exact: true })).toBeVisible()

    // Не перезагружаем страницу: ждём сигнал realtime. 20 секунд заметно меньше фолбэка в 120 с.
    const cancel = await admin.request.post(`/api/booking/admin/bookings/${bookingId}/cancel`, {
      headers: await csrf(admin),
    })
    expect(cancel.status()).toBe(200)
    cancelled = true
    await expect(card.getByText('Отменена', { exact: true })).toBeVisible({ timeout: 20_000 })
  } finally {
    try {
      if (bookingId !== undefined && !cancelled) {
        await admin.request.post(`/api/booking/admin/bookings/${bookingId}/cancel`, {
          headers: await csrf(admin),
        })
      }
    } finally {
      await player.close()
      await admin.close()
    }
  }
})
