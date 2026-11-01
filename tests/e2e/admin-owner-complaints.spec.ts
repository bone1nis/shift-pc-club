import { expect, test, type Page } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

async function loginOwner(page: Page) {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await page.getByLabel('Электронная почта').fill('owner@shift.local')
  await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
  await page.getByRole('button', { name: /Начать смену/ }).click()
  await expect(page).toHaveURL(/\/admin\/$/)
}

// Владелец настраивает ключ, читает жалобу, а в чистом контексте браузера восстанавливает ключ по коду.
// Предполагает свежую базу без ключа владельца и хотя бы одну жалобу, отправленную игроком после настройки.
test('owner reads a complaint and restores the key on a clean browser by recovery code', async ({
  browser,
  isMobile,
}) => {
  test.skip(isMobile, 'Достаточно десктопа')
  test.setTimeout(180_000)
  const first = await browser.newContext()
  const page = await first.newPage()
  let code = ''
  let authorName = ''
  const text = `Жалоба владельцу ${Date.now()}`
  try {
    await loginOwner(page)
    await page.goto('/admin/complaints', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Жалобы', level: 1 })).toBeVisible()

    // Первый вход: мастер. Ключ на сервере есть, а на устройстве нет (код потерян): «создать новый ключ».
    // Ключ уже и на устройстве есть: «Сменить ключ».
    const create = page.getByRole('button', { name: 'Создать ключ' })
    const lost = page.getByRole('button', { name: 'Не помню код — создать новый ключ' })
    const rotate = page.getByRole('button', { name: 'Сменить ключ' })
    await expect(create.or(lost).or(rotate)).toBeVisible()
    if (await create.isVisible()) await create.click()
    else if (await lost.isVisible()) {
      await expect(page.getByText('Жалобы, зашифрованные прежним ключом')).toBeVisible()
      await expect(lost).toBeDisabled()
      await page.getByText('Понимаю, что старые жалобы станут недоступны').click()
      await lost.click()
    } else {
      await rotate.click()
      await page.getByRole('dialog').getByRole('button', { name: 'Сменить ключ' }).click()
    }
    code = ((await page.getByTestId('recovery-code').textContent()) ?? '').trim()
    expect(code.replace(/-/g, '')).toHaveLength(32)
    const finish = page.getByRole('button', { name: 'Завершить настройку' })
    await expect(finish).toBeDisabled()
    await page.getByText('Я записал код восстановления').click()
    await finish.click()
    await expect(page.getByTestId('fingerprint')).toBeVisible()

    // Игрок отправляет жалобу через UI, владелец расшифровывает её (в том числе имя автора).
    const playerCtx = await browser.newContext()
    const player = await playerCtx.newPage()
    try {
      await player.goto('/auth?next=/account/feedback', { waitUntil: 'domcontentloaded' })
      await waitForInteractive(player)
      // Свежий игрок на каждый прогон: у demo-игрока лимит 5 жалоб в сутки.
      await player.getByRole('tab', { name: 'Регистрация' }).click()
      await player.getByLabel('Имя').fill('E2E Игрок')
      await player
        .getByLabel('Электронная почта')
        .fill(`e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@shift.local`)
      await player.getByLabel('Пароль', { exact: true }).fill('E2eRegister2026!x')
      await player.keyboard.press('Enter')
      await expect(player).toHaveURL((url) => url.pathname === '/account/feedback')
      const me = await playerCtx.request.get('/api/auth/me')
      const meBody = await me.text()
      authorName = (JSON.parse(meBody).data as { name?: string } | undefined)?.name ?? ''
      expect(authorName, meBody).not.toBe('')
      await expect(player.getByTestId('owner-fingerprint')).toHaveText(/^(\d{5} ){11}\d{5}$/)
      await player.getByRole('button', { name: /Категория/ }).click()
      await player.getByRole('option', { name: 'Персонал' }).click()
      await player.getByRole('button', { name: '4', exact: true }).click()
      await player.getByLabel('Текст обращения').fill(text)
      await player.getByText('Показать моё имя владельцу').click()
      await player.getByRole('button', { name: 'Отправить владельцу' }).click()
      await expect(player.getByText('Обращение зашифровано на вашем устройстве')).toBeVisible()
    } finally {
      await playerCtx.close()
    }

    await page.reload()
    await page
      .getByRole('button', { name: /Открыть/ })
      .first()
      .click()
    const body = page.getByTestId('complaint-text')
    await expect(body).toContainText(text)
    await expect(body.getByText('Автор', { exact: true })).toBeVisible()
    await expect(body).toContainText(authorName)
    await page.getByRole('button', { name: 'Отметить прочитанной' }).click()
  } finally {
    await first.close()
  }

  // Чистый контекст: IndexedDB пуст, ключ на сервере есть.
  const clean = await browser.newContext()
  const fresh = await clean.newPage()
  try {
    await loginOwner(fresh)
    await fresh.goto('/admin/complaints', { waitUntil: 'domcontentloaded' })
    await expect(fresh.getByRole('heading', { name: 'Восстановить ключ' })).toBeVisible()
    await fresh.getByLabel('Код восстановления').fill('AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA')
    await fresh.getByRole('button', { name: 'Восстановить' }).click()
    await expect(fresh.getByText('Код восстановления не подошёл')).toBeVisible()
    await fresh.getByLabel('Код восстановления').fill(code)
    await fresh.getByRole('button', { name: 'Восстановить' }).click()
    await expect(fresh.getByTestId('fingerprint')).toBeVisible()
    await fresh
      .getByRole('button', { name: /Открыть/ })
      .first()
      .click()
    await expect(fresh.getByTestId('complaint-text')).toContainText(text)
  } finally {
    await clean.close()
  }
})

test('admin does not see the complaints section', async ({ page }) => {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await page.getByLabel('Электронная почта').fill('admin@shift.local')
  await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
  await page.getByRole('button', { name: /Начать смену/ }).click()
  await expect(page).toHaveURL(/\/admin\/$/)
  await expect(page.getByRole('link', { name: 'Жалобы' })).toHaveCount(0)
  await page.goto('/admin/complaints', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/admin\/$/)
  const response = await page.request.get('/api/club/owner/complaints')
  expect(response.status()).toBe(403)
})
