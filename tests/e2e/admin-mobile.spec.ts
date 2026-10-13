import { expect, test } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

// Мобильная админка не должна прокручивать всю страницу вбок (таблицы прокручиваются внутри своего блока).
test('admin sections fit the phone viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Нужен только профиль телефона')
  test.setTimeout(120_000)
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await page.getByLabel('Электронная почта').fill('admin@shift.local')
  await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
  await page.getByRole('button', { name: /Начать смену/ }).click()
  await expect(page).toHaveURL(/\/admin\/$/)
  const wide: string[] = []
  for (const section of [
    '',
    'schedule',
    'equipment',
    'tariffs',
    'club',
    'users',
    'reports',
    'notifications',
    'processing',
    'audit',
  ]) {
    await page.goto(`/admin/${section}`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toHaveCount(1, { timeout: 20_000 })
    await page.waitForTimeout(700)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    if (overflow > 1) wide.push(`/${section}: +${overflow}px`)
  }
  expect(wide).toEqual([])
})
