import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { waitForInteractive } from './support/hydration'
import { pickDateTime } from './support/pickers'

// Реальный локальный стенд: без подмены API, без сброса базы и без общего storageState.
test.describe.configure({ retries: 0 })

test('player booking → admin check-in → visible session → checkout', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(20 * 60_000)
  expect(
    baseURL,
    'Start the local stack on E2E_BASE_URL (default http://localhost:8088)',
  ).toBeTruthy()
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(new URL(baseURL!).hostname)
  const player = await browser.newContext({ baseURL, timezoneId: 'Europe/Moscow' })
  const admin = await browser.newContext({ baseURL, timezoneId: 'Europe/Moscow' })
  const playerPage = await player.newPage()
  const adminPage = await admin.newPage()
  playerPage.setDefaultTimeout(30_000)
  adminPage.setDefaultTimeout(30_000)
  let bookingId: number | undefined
  let sessionId: number | undefined

  async function login(page: Page, isAdmin: boolean) {
    await page.goto(isAdmin ? '/admin/login' : '/auth?next=/booking', {
      waitUntil: 'domcontentloaded',
    })
    await waitForInteractive(page)
    await page
      .getByLabel('Электронная почта')
      .fill(isAdmin ? 'admin@shift.local' : 'player@shift.local')
    await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: isAdmin ? /Начать смену/ : /Войти в SHIFT/ }).click(),
    ])
    expect(response.status()).toBe(200)
    await expect(page).toHaveURL(isAdmin ? /\/admin\/$/ : /\/booking$/)
  }

  async function mutation(context: BrowserContext, path: string) {
    const cookies = await context.cookies(baseURL!)
    const csrf = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value
    expect(csrf, 'CSRF cookie required for cleanup').toBeTruthy()
    return context.request.post(path, {
      headers: { Origin: new URL(baseURL!).origin, 'X-CSRF-TOKEN': decodeURIComponent(csrf!) },
    })
  }

  try {
    await test.step('Player and administrator log in independently', async () => {
      await login(playerPage, false)
      await login(adminPage, true)
    })

    // Booking starts must be on a half-hour boundary. В режиме prod ждём настоящее окно заселения (до ~16 минут).
    const catalogResponse = await player.request.get('/api/club/catalog')
    expect(catalogResponse.status()).toBe(200)
    const serverNow = Date.parse(catalogResponse.headers().date)
    expect(Number.isFinite(serverNow)).toBe(true)
    const halfHour = 30 * 60_000
    const startsAt = Math.ceil((serverNow + 60_000) / halfHour) * halfHour
    // В режиме dev (по умолчанию) окно заселения открыто заранее; SHIFT_MODE=prod возвращает настоящее окно за 15 минут.
    const strictWindow = process.env.SHIFT_MODE === 'prod'
    const waitMs = strictWindow ? Math.max(0, startsAt - 15 * 60_000 - serverNow + 1000) : 0
    if (waitMs > 0) {
      console.info(`Waiting ${Math.ceil(waitMs / 1000)}s for the real check-in window`)
      test.info().annotations.push({
        type: 'real-time window',
        description: `Waiting ${Math.ceil(waitMs / 1000)}s until check-in opens`,
      })
      const deadline = Date.now() + waitMs
      while (Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, Math.min(60_000, deadline - Date.now())))
    }
    const endsAt = startsAt + 60 * 60_000
    const availableResponse = await player.request.get('/api/booking/availability', {
      params: {
        starts_at: new Date(startsAt - halfHour).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      },
    })
    expect(availableResponse.status()).toBe(200)
    const availability = (await availableResponse.json()).data as {
      workstation_id: number
      available: boolean
    }[]
    const catalog = (await catalogResponse.json()).data as {
      workstations: { id: number; name: string; zone_id: number }[]
    }
    const workstation = catalog.workstations.find((w) =>
      availability.some((a) => a.workstation_id === w.id && a.available),
    )
    expect(
      workstation,
      'Demo needs one free workstation for the current and next slot',
    ).toBeTruthy()

    await test.step('Player creates a booking through the seat map', async () => {
      await playerPage.goto(`/booking?zone=${workstation!.zone_id}`, {
        waitUntil: 'domcontentloaded',
      })
      const picker = playerPage.getByRole('button', { name: /Когда играем\?/ })
      await expect(picker).not.toHaveAttribute('data-value', '')
      await playerPage.getByRole('button', { name: '1 ч', exact: true }).click()
      const moscowStart = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
        .format(startsAt)
        .replace(' ', 'T')
      await pickDateTime(playerPage, /Когда играем\?/, moscowStart)
      const seat = playerPage.getByRole('button', {
        name: `${workstation!.name}, свободно`,
        exact: true,
      })
      await expect(seat).toBeEnabled()
      await seat.click()
      const [created] = await Promise.all([
        playerPage.waitForResponse(
          (r) => r.url().endsWith('/api/booking/bookings') && r.request().method() === 'POST',
        ),
        playerPage.getByRole('button', { name: /Подтвердить бронь/ }).click(),
      ])
      expect(created.status()).toBe(201)
      bookingId = ((await created.json()).data as { id: number }).id
      await expect(playerPage).toHaveURL(new RegExp(`/account\\?booked=${bookingId}$`))
      await expect(
        playerPage.getByText(`Бронь №${bookingId} подтверждена. До встречи в SHIFT!`, {
          exact: true,
        }),
      ).toBeVisible()
    })

    await test.step('Administrator checks in this exact booking', async () => {
      await adminPage.goto('/admin/schedule', { waitUntil: 'domcontentloaded' })
      const row = adminPage
        .getByRole('row')
        .filter({ has: adminPage.getByRole('cell', { name: `#${bookingId}`, exact: true }) })
      const [checkedIn] = await Promise.all([
        adminPage.waitForResponse(
          (r) =>
            r.url().endsWith(`/bookings/${bookingId}/check-in`) && r.request().method() === 'POST',
        ),
        row.getByRole('button', { name: 'Заселить', exact: true }).click(),
      ])
      expect(checkedIn.status()).toBe(200)
      const sessions = (await checkedIn.json()).data as {
        id: number
        booking_id: number
        status: string
      }[]
      expect(sessions).toHaveLength(1)
      expect(sessions[0].booking_id).toBe(bookingId)
      expect(sessions[0].status).toBe('active')
      sessionId = sessions[0].id
    })

    await test.step('Player sees the active session through polling', async () => {
      const card = playerPage
        .getByTestId('session-card')
        .filter({ hasText: `Сессия #${sessionId}` })
      await expect(card).toBeVisible({ timeout: 40_000 })
      await expect(card.getByText('В игре', { exact: true })).toBeVisible()
    })

    await test.step('Administrator completes the session; player sees checkout', async () => {
      await adminPage.goto('/admin/', { waitUntil: 'domcontentloaded' })
      const card = adminPage
        .locator('article')
        .filter({ hasText: new RegExp(`Сессия №${sessionId} ·`) })
      const [ended] = await Promise.all([
        adminPage.waitForResponse(
          (r) => r.url().endsWith(`/sessions/${sessionId}/end`) && r.request().method() === 'POST',
        ),
        card.getByRole('button', { name: 'Завершить', exact: true }).click(),
      ])
      expect(ended.status()).toBe(200)
      expect((await ended.json()).data.status).toBe('completed')
      await expect(
        playerPage.getByTestId('session-card').filter({ hasText: `Сессия #${sessionId}` }),
      ).toHaveCount(0, { timeout: 40_000 })
      const sessionsResponse = await player.request.get('/api/booking/sessions')
      expect(sessionsResponse.status()).toBe(200)
      const sessions = (await sessionsResponse.json()).data as { id: number; status: string }[]
      expect(sessions.find((s) => s.id === sessionId)?.status).toBe('completed')
      await expect(
        playerPage
          .getByRole('row')
          .filter({
            has: playerPage.getByRole('cell', { name: `PC #${workstation!.id}`, exact: true }),
          })
          .first(),
      ).toBeVisible()
    })
  } finally {
    // Завершаем и отменяем только записи, созданные этим прогоном; историю и прочие данные не трогаем.
    try {
      if (bookingId !== undefined) {
        const response = await admin.request.get('/api/booking/admin/sessions')
        expect(response.status(), 'Read sessions for cleanup').toBe(200)
        const sessions = (await response.json()).data as {
          id: number
          booking_id: number | null
          status: string
        }[]
        for (const session of sessions.filter(
          (s) => s.booking_id === bookingId && s.status !== 'completed',
        )) {
          expect(
            (await mutation(admin, `/api/booking/admin/sessions/${session.id}/end`)).status(),
          ).toBe(200)
        }
        const booking = await player.request.get(`/api/booking/bookings/${bookingId}`)
        expect(booking.status()).toBe(200)
        if ((await booking.json()).data.status === 'confirmed') {
          expect(
            (await mutation(admin, `/api/booking/admin/bookings/${bookingId}/cancel`)).status(),
          ).toBe(200)
        }
      }
    } finally {
      await player.close()
      await admin.close()
    }
  }
})
