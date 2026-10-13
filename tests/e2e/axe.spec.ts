import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// WCAG 2.x A/AA, включая контраст цвета.
for (const path of ['/', '/booking', '/auth']) {
  test(`${path}: no axe violations`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toHaveCount(1, { timeout: 20_000 })
    await page.waitForLoadState('load')
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(
      result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} nodes — ${v.help}`),
    ).toEqual([])
  })
}
