import { expect, test } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

// Продление и пересадка: диалог открывается, выпадающий список виден поверх диалога, действия применяются.
test('administrator extends and moves a guest session through dialogs', async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'Достаточно десктопа: диалоги и выпадающие списки покрывает unit-тест компонентов',
  )
  test.setTimeout(120_000)
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await waitForInteractive(page)
  await page.getByLabel('Электронная почта').fill('admin@shift.local')
  await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
  await page.getByRole('button', { name: /Начать смену/ }).click()
  await expect(page).toHaveURL(/\/admin\/$/)

  await page.goto('/admin/schedule', { waitUntil: 'domcontentloaded' })
  // Берём последнее место Арены и короткую сессию: первые места могут быть заняты чужими бронями.
  await page.getByRole('button', { name: /Свободное место/ }).click()
  await page.getByRole('option', { name: 'PC-16' }).click()
  await page.getByRole('button', { name: /Время/ }).click()
  await page.getByRole('option', { name: '60 мин', exact: true }).click()
  const started = page.getByRole('button', { name: 'Начать сессию' })
  await expect(started).toBeEnabled({ timeout: 20_000 })
  const [created] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/api/booking/admin/sessions') && r.request().method() === 'POST',
    ),
    started.click(),
  ])
  expect(created.status()).toBe(201)
  const sessionId = (await created.json()).data.id as number

  await page.goto('/admin/', { waitUntil: 'domcontentloaded' })
  const tile = page.locator('article').filter({ hasText: new RegExp(`Сессия №${sessionId} ·`) })
  try {
    await expect(tile).toBeVisible({ timeout: 20_000 })

    // Продление: диалог остаётся открытым, пока администратор не подтвердит.
    await tile.getByRole('button', { name: 'Продлить', exact: true }).click()
    const extend = page.getByRole('dialog', { name: `Продлить сессию №${sessionId}` })
    await expect(extend).toBeVisible()
    await page.waitForTimeout(1500)
    await expect(extend).toBeVisible()
    await extend.getByRole('button', { name: '30 мин' }).click()
    const [extended] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/sessions/${sessionId}/extend`)),
      extend.getByRole('button', { name: 'Продлить', exact: true }).click(),
    ])
    expect(extended.status()).toBe(200)
    await expect(extend).toBeHidden()

    // Пересадка: список мест должен быть над диалогом, а не за ним.
    await tile.getByRole('button', { name: 'Пересадить', exact: true }).click()
    const move = page.getByRole('dialog', { name: `Пересадить сессию №${sessionId}` })
    await expect(move).toBeVisible()
    await move.getByRole('button', { name: /Новое место/ }).click()
    const list = page.getByRole('listbox')
    await expect(list).toBeVisible()
    const box = (await list.boundingBox())!
    const topElementIsList = await page.evaluate(
      ([x, y]) => Boolean(document.elementFromPoint(x!, y!)?.closest('[role="listbox"]')),
      [box.x + box.width / 2, box.y + box.height / 2],
    )
    expect(topElementIsList, 'listbox must be rendered above the dialog').toBe(true)
    await list.getByRole('option').nth(1).click()

    // Отказ сервера не должен пропадать молча: причина видна прямо в диалоге.
    await page.route('**/move', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Место занято.' }),
      }),
    )
    await move.getByRole('button', { name: 'Пересадить', exact: true }).click()
    await expect(move.getByRole('alert')).toHaveText('Место занято.')
    await expect(move).toBeVisible()
    await page.unroute('**/move')
    const [moved] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/sessions/${sessionId}/move`)),
      move.getByRole('button', { name: 'Пересадить', exact: true }).click(),
    ])
    expect(moved.status()).toBe(200)
    await expect(move).toBeHidden()
  } finally {
    await tile
      .getByRole('button', { name: 'Завершить', exact: true })
      .click({ timeout: 10_000 })
      .catch(() => undefined)
  }
})
