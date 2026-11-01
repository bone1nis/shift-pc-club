import { expect, test, type Page } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

async function loginAdmin(page: Page) {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await page.getByLabel('Электронная почта').fill('admin@shift.local')
  await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
  await page.getByRole('button', { name: /Начать смену/ }).click()
  await expect(page).toHaveURL(/\/admin\/$/)
}

// Заселение во второй вкладке появляется на карте зала в первой без перезагрузки (раньше 30 с опроса).
test('session started in one tab shows up in another tab without reload', async ({
  browser,
  isMobile,
}) => {
  test.skip(isMobile, 'Достаточно десктопа')
  test.setTimeout(120_000)
  const context = await browser.newContext()
  const watcher = await context.newPage()
  const actor = await context.newPage()
  let sessionId: number | undefined
  try {
    await loginAdmin(watcher)
    await watcher.goto('/admin/', { waitUntil: 'domcontentloaded' })
    await expect(watcher.getByRole('heading', { name: 'Смена', level: 1 })).toBeVisible()

    await actor.goto('/admin/schedule', { waitUntil: 'domcontentloaded' })
    await waitForInteractive(actor)
    await actor.getByRole('button', { name: /Свободное место/ }).click()
    // Первое свободное место: PC-* могут быть заняты остатками прошлых прогонов.
    await actor.getByRole('option').first().click()
    await actor.getByRole('button', { name: /Время/ }).click()
    await actor.getByRole('option', { name: '60 мин', exact: true }).click()
    const start = actor.getByRole('button', { name: 'Начать сессию' })
    await expect(start).toBeEnabled({ timeout: 20_000 })
    const [created] = await Promise.all([
      actor.waitForResponse(
        (r) => r.url().endsWith('/api/booking/admin/sessions') && r.request().method() === 'POST',
      ),
      start.click(),
    ])
    expect(created.status()).toBe(201)
    const id = (await created.json()).data.id as number
    sessionId = id

    // Тайл должен появиться раньше периодического опроса (30 с).
    const tile = watcher.locator('article').filter({ hasText: new RegExp(`Сессия №${id} ·`) })
    await expect(tile).toBeVisible({ timeout: 10_000 })
  } finally {
    try {
      if (sessionId !== undefined) {
        const token = (await context.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value
        await context.request.post(`/api/booking/admin/sessions/${sessionId}/end`, {
          headers: {
            Origin: new URL(actor.url()).origin,
            'X-CSRF-TOKEN': decodeURIComponent(token ?? ''),
          },
        })
      }
    } finally {
      await context.close()
    }
  }
})
