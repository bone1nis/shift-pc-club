import { expect, test } from '@playwright/test'

// Реальный локальный стенд; подменяется только сеть браузера.
test.describe('network failures and access control', () => {
  test('booking page shows a recoverable error when the catalog is unreachable', async ({
    page,
  }) => {
    await page.route('**/api/club/catalog', (route) => route.abort('failed'))
    await page.goto('/booking', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 20_000 })
    await page.unroute('**/api/club/catalog')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('status').filter({ hasText: 'Загружаем схему клуба' })).toBeHidden({
      timeout: 20_000,
    })
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('anonymous visitors are sent to sign-in from the account page', async ({ page }) => {
    await page.goto('/account', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 })
  })
})
