import { expect, test } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

test('owner signs in to the admin panel', async ({ page }) => {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await page.getByLabel('Электронная почта').fill('owner@shift.local')
  await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
  await page.getByRole('button', { name: /Начать смену/ }).click()
  await expect(page).toHaveURL(/\/admin\/$/)
  await expect(page.getByRole('navigation', { name: 'Управление клубом' })).toBeVisible()
})
