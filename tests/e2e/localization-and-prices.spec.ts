import { expect, test } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

test('validation errors on the sign-up form are in Russian', async ({ page }) => {
  await page.goto('/auth', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await page.getByRole('tab', { name: 'Регистрация' }).click()
  await page.getByLabel('Имя').fill('Игрок')
  await page.getByLabel('Электронная почта').fill('not-an-email')
  await page.getByLabel('Пароль', { exact: true }).fill('short')
  await page.keyboard.press('Enter')
  const errors = page.locator('.field__error, [role="alert"]')
  await expect(errors.first()).toBeVisible({ timeout: 20_000 })
  const text = (await errors.allInnerTexts()).join(' ')
  expect(text).toMatch(/Пароль должен содержать не меньше 12 символов/)
  expect(text).not.toMatch(/The .* field|must be/)
})

test('booking summary explains the price: hourly rate × hours = total', async ({ page }) => {
  await page.goto('/booking', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  const seat = page.getByRole('button', { name: /^PC-\d+, свободно$/ }).first()
  await expect(seat).toBeEnabled({ timeout: 20_000 })
  await seat.click()
  await expect(page.getByText('180 ₽ / ч × 3 ч = 540 ₽')).toBeVisible()
  await expect(page.getByText('Предварительно')).toBeVisible()
})

test('admin visitors section opens without a validation error', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Достаточно десктопа')
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await page.getByLabel('Электронная почта').fill('admin@shift.local')
  await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
  await page.getByRole('button', { name: /Начать смену/ }).click()
  await expect(page).toHaveURL(/\/admin\/$/)
  await page.goto('/admin/users', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/#\d+ · /).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})
