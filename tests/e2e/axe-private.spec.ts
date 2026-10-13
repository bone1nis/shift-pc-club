import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

// Закрытые экраны: кабинет игрока и каждый раздел администратора (axe, WCAG 2.x A/AA).
async function login(page: Page, admin: boolean) {
  await page.goto(admin ? '/admin/login' : '/auth?next=/account', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await page
    .getByLabel('Электронная почта')
    .fill(admin ? 'admin@shift.local' : 'player@shift.local')
  await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
  await page.getByRole('button', { name: admin ? /Начать смену/ : /Войти в SHIFT/ }).click()
  await expect(page).toHaveURL(admin ? /\/admin\/$/ : /\/account$/)
}

async function scan(page: Page) {
  await page.waitForLoadState('load')
  await expect(page.locator('h1')).toHaveCount(1, { timeout: 20_000 })
  await page.waitForTimeout(800)
  // Контраст нельзя мерить, пока блок полупрозрачен посреди анимации появления.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          // Ждём только конечные анимации; бесконечные (лента, фон героя) не завершаются.
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]),
  )
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return result.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
  )
}

test('player account has no axe violations', async ({ page }) => {
  await login(page, false)
  expect(await scan(page)).toEqual([])
})

test('every administrator section has no axe violations', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page, true)
  const problems: string[] = []
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
    for (const issue of await scan(page)) problems.push(`/${section}: ${issue}`)
  }
  expect(problems).toEqual([])
})
