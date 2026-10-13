import { expect, test } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

// Реальный локальный стенд. Каждый прогон регистрирует нового игрока, существующего только локально.
test('player registers with the keyboard and lands on booking; private pages are noindex', async ({
  page,
  baseURL,
}) => {
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(new URL(baseURL!).hostname)
  await page.goto('/auth?next=/booking', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await page.getByRole('tab', { name: 'Регистрация' }).click()
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@shift.local`
  await page.getByLabel('Имя').fill('E2E Игрок')
  await page.getByLabel('Электронная почта').fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill('E2eRegister2026!x')
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/api/auth/register') && r.request().method() === 'POST',
    ),
    page.keyboard.press('Enter'),
  ])
  expect(response.status()).toBe(201)
  await expect(page).toHaveURL(/\/booking$/)
})
