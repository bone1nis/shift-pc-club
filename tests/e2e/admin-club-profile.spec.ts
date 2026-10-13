import { expect, test, type Page } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

// Реальный локальный стенд: администратор правит публичный профиль, и лендинг его показывает.
async function loginAdmin(page: Page) {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await page.getByLabel('Электронная почта').fill('admin@shift.local')
  await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
  await page.getByRole('button', { name: /Начать смену/ }).click()
  await expect(page).toHaveURL(/\/admin\/$/)
}

async function setPhone(page: Page, phone: string) {
  await page.goto('/admin/club', { waitUntil: 'domcontentloaded' })
  const field = page.getByLabel('Телефон')
  await expect(field).toHaveValue(/\+7/)
  await field.fill(phone)
  await page.getByRole('button', { name: 'Сохранить профиль' }).click()
  await expect(page.getByText('Профиль клуба сохранён')).toBeVisible()
}

test('administrator edits contacts and the landing reflects them', async ({ page, browser }) => {
  test.setTimeout(120_000)
  await loginAdmin(page)
  const original = await page.request
    .get('/api/club/profile')
    .then(async (r) => (await r.json()).data.phone as string)
  try {
    await setPhone(page, '+7 (495) 555-01-77')
    const visitor = await browser.newPage()
    await visitor.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(
      visitor.locator('#contacts').getByRole('link', { name: '+7 (495) 555-01-77' }),
    ).toBeVisible()
    await visitor.close()
  } finally {
    await setPhone(page, original)
  }
})

test('invalid contacts are rejected with a field error', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('/admin/club', { waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel('Телефон')).toHaveValue(/\+7/)
  await page.getByLabel('Email').fill('not-an-email')
  await page.getByRole('button', { name: 'Сохранить профиль' }).click()
  await expect(page.getByRole('alert').first()).toBeVisible()
})
