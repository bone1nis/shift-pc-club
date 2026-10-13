import { expect, test } from '@playwright/test'

for (const path of ['/', '/booking', '/auth']) {
  test(`${path} has no horizontal overflow and a single h1`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toHaveCount(1, { timeout: 20_000 })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await expect(page.locator('h1')).toHaveCount(1)
    // Проверяем документ, отрисованный на сервере: клиент Nuxt в dev-режиме может переписать атрибуты <html>.
    const html = await (await page.request.get(path, { headers: { Accept: 'text/html' } })).text()
    expect(html).toMatch(/<html[^>]*lang="ru"/)
  })
}
