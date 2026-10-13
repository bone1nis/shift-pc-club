import { expect, test } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

test('administrator filters the report by zone and sees daily snapshots and the site funnel', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Достаточно десктопа: мобильную раскладку покрывает admin-mobile.spec.ts')
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await page.getByLabel('Электронная почта').fill('admin@shift.local')
  await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
  await page.getByRole('button', { name: /Начать смену/ }).click()
  await expect(page).toHaveURL(/\/admin\/$/)

  await page.goto('/admin/reports', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Воронка сайта за период')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ежедневные сводки' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Ежедневные сводки' })).toBeVisible()

  await page.getByRole('button', { name: /Зона/ }).click()
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/booking/admin/reports?') && r.url().includes('zone_id=2'),
    ),
    page
      .getByRole('option', { name: 'VIP' })
      .click()
      .then(() => page.getByRole('button', { name: 'Показать отчёт' }).click()),
  ])
  expect(response.status()).toBe(200)
  expect((await response.json()).data.zone_id).toBe(2)
})
