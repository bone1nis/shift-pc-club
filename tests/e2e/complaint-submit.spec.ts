import { expect, test } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

// Реальный стенд (не запускается автоматически). Нужен настроенный ключ владельца (GET /api/club/owner-key = 200)
// и игрок player@shift.local.
test.describe.configure({ retries: 0 })

test('жалоба уходит зашифрованной: в сетевом запросе нет открытого текста', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Достаточно десктопа')
  const secret = `Секретная жалоба ${Date.now()}`
  const bodies: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/club/complaints') && request.method() === 'POST')
      bodies.push(request.postData() ?? '')
  })

  await page.goto('/auth?next=/account/feedback', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  // Свежий игрок на каждый прогон: у demo-игрока лимит 5 жалоб в сутки.
  await page.getByRole('tab', { name: 'Регистрация' }).click()
  await page.getByLabel('Имя').fill('E2E Игрок')
  await page
    .getByLabel('Электронная почта')
    .fill(`e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@shift.local`)
  await page.getByLabel('Пароль', { exact: true }).fill('E2eRegister2026!x')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL((url) => url.pathname === '/account/feedback')

  await expect(page.getByTestId('owner-fingerprint')).toHaveText(/^(\d{5} ){11}\d{5}$/)
  await page.getByRole('button', { name: /Категория/ }).click()
  await page.getByRole('option', { name: 'Персонал' }).click()
  await page.getByRole('button', { name: '4', exact: true }).click()
  await page.getByLabel('Текст обращения').fill(secret)
  await page.getByRole('button', { name: 'Отправить владельцу' }).click()

  await expect(page.getByText('Обращение зашифровано на вашем устройстве')).toBeVisible()
  expect(bodies).toHaveLength(1)
  expect(bodies[0]).not.toContain('Секретная')
  expect(bodies[0]).not.toContain(secret)
  expect(JSON.parse(bodies[0]!)).toMatchObject({ category: 'staff', rating: 4 })
})
