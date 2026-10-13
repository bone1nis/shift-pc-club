import { expect, test } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

for (const path of ['/', '/booking', '/auth']) {
  test(`${path}: controls have accessible names and images have alt text`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toHaveCount(1, { timeout: 20_000 })
    const problems = await page.evaluate(() => {
      const name = (el: Element) =>
        (
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby') ||
          (el as HTMLElement).innerText ||
          el.getAttribute('title') ||
          ''
        ).trim()
      const issues: string[] = []
      document.querySelectorAll('button, a[href]').forEach((el) => {
        if (!name(el))
          issues.push(`unnamed ${el.tagName.toLowerCase()}: ${el.outerHTML.slice(0, 80)}`)
      })
      document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach((el) => {
        const input = el as HTMLInputElement
        if (
          !input.labels?.length &&
          !el.getAttribute('aria-label') &&
          !el.getAttribute('aria-labelledby')
        )
          issues.push(`unlabelled field: ${el.outerHTML.slice(0, 80)}`)
      })
      document.querySelectorAll('img').forEach((el) => {
        if (el.getAttribute('alt') === null)
          issues.push(`img without alt: ${el.outerHTML.slice(0, 80)}`)
      })
      return issues
    })
    expect(problems).toEqual([])
  })
}

test('/auth: the form is reachable and submittable with the keyboard only', async ({ page }) => {
  await page.goto('/auth', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await page.locator('#email').focus()
  await page.keyboard.type('nobody@shift.local')
  await page.keyboard.press('Tab')
  await expect(page.locator('#password')).toBeFocused()
  await page.keyboard.type('WrongPassword2026!')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 })
})
