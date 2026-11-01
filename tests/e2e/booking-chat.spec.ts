import { expect, test, type BrowserContext } from '@playwright/test'
import { waitForInteractive } from './support/hydration'

// Реальный стенд (не запускается автоматически). Нужна подтверждённая бронь player@shift.local,
// владелец которой участвует в чате (проекция участников из событий Booking).
test.describe.configure({ retries: 0 })

test('владелец приглашает друга, они переписываются в чате брони', async ({
  browser,
  baseURL,
  isMobile,
}) => {
  test.skip(isMobile, 'Двухконтекстный сценарий: достаточно десктопа')
  test.setTimeout(3 * 60_000)
  const owner = await browser.newContext({ baseURL })
  const friend = await browser.newContext({ baseURL })
  const ownerPage = await owner.newPage()
  const friendPage = await friend.newPage()

  await test.step('владелец входит и открывает чат первой брони', async () => {
    await ownerPage.goto('/auth?next=/account', { waitUntil: 'domcontentloaded' })
    await waitForInteractive(ownerPage)
    await ownerPage.getByLabel('Электронная почта').fill('player@shift.local')
    await ownerPage.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
    await ownerPage.getByRole('button', { name: /Войти в SHIFT/ }).click()
    await expect(ownerPage).toHaveURL((url) => url.pathname === '/account')
  })
  const admin = await browser.newContext({ baseURL })
  let bookingId: number | undefined
  const csrf = async (context: BrowserContext) => {
    const cookie = (await context.cookies(baseURL!)).find((c) => c.name === 'XSRF-TOKEN')
    expect(cookie, 'CSRF cookie').toBeTruthy()
    return {
      Origin: new URL(baseURL!).origin,
      'X-CSRF-TOKEN': decodeURIComponent(cookie!.value),
    }
  }
  try {
    await test.step('бронь создаётся через API', async () => {
      const adminPage = await admin.newPage()
      await adminPage.goto('/admin/login', { waitUntil: 'domcontentloaded' })
      await waitForInteractive(adminPage)
      await adminPage.getByLabel('Электронная почта').fill('admin@shift.local')
      await adminPage.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
      await adminPage.getByRole('button', { name: /Начать смену/ }).click()
      await expect(adminPage).toHaveURL(/\/admin\/$/)

      const halfHour = 30 * 60_000
      const catalog = (await (await owner.request.get('/api/club/catalog')).json()).data as {
        workstations: { id: number }[]
      }
      const base = Math.ceil((Date.now() + 3 * 24 * 3_600_000) / halfHour) * halfHour
      let startsAt = base
      let workstationId: number | undefined
      for (let shift = 0; shift < 12 && workstationId === undefined; shift += 1) {
        startsAt = base + shift * 2 * 3_600_000
        const free = (
          await (
            await owner.request.get('/api/booking/availability', {
              params: {
                starts_at: new Date(startsAt).toISOString(),
                ends_at: new Date(startsAt + 3_600_000).toISOString(),
              },
            })
          ).json()
        ).data as { workstation_id: number; available: boolean }[]
        workstationId = catalog.workstations.find((w) =>
          free.some((a) => a.workstation_id === w.id && a.available),
        )?.id
      }
      expect(workstationId, 'Нужно свободное место через 3 суток').toBeTruthy()
      const created = await owner.request.post('/api/booking/bookings', {
        headers: { ...(await csrf(owner)), 'Idempotency-Key': crypto.randomUUID() },
        data: {
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(startsAt + 3_600_000).toISOString(),
          workstation_ids: [workstationId],
        },
      })
      expect(created.status()).toBe(201)
      bookingId = ((await created.json()).data as { id: number }).id
      // участник-владелец появляется асинхронно (booking.confirmed → realtime-worker): ждём проекцию
      await expect
        .poll(
          async () =>
            (await owner.request.get(`/api/realtime/conversations/${bookingId}`)).status(),
          {
            timeout: 30_000,
          },
        )
        .toBe(200)
      await ownerPage.reload({ waitUntil: 'domcontentloaded' })
      await waitForInteractive(ownerPage)
    })
    const card = ownerPage.locator('.booking-card').filter({ hasText: `Бронь #${bookingId}` })
    await expect(card).toBeVisible()
    const chatButton = card.getByRole('button', { name: 'Чат', exact: true })
    await expect(chatButton).toBeVisible()
    await chatButton.click()
    await expect(ownerPage.getByText('Чат модерируется администратором клуба.')).toBeVisible()

    let inviteUrl = ''
    await test.step('владелец получает ссылку-приглашение', async () => {
      await ownerPage.getByRole('button', { name: 'Пригласить друга' }).click()
      const field = ownerPage.getByLabel('Ссылка-приглашение')
      await expect(field).toHaveValue(/\/invite\/.+/)
      inviteUrl = await field.inputValue()
    })

    await test.step('друг регистрируется по ссылке и попадает в чат', async () => {
      const path = new URL(inviteUrl).pathname
      await friendPage.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(friendPage).toHaveURL(/\/auth\?next=/)
      await waitForInteractive(friendPage)
      await friendPage.getByRole('tab', { name: /Регистрация/ }).click()
      const email = `e2e-chat-${Date.now()}@shift.local`
      await friendPage.getByLabel('Имя').fill('Друг Е2Е')
      await friendPage.getByLabel('Электронная почта').fill(email)
      await friendPage.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
      const confirm = friendPage.getByLabel('Повторите пароль')
      if (await confirm.count()) await confirm.fill('ShiftDemo2026!')
      await friendPage.getByRole('button', { name: /Создать|Зарегистр/ }).click()
      await expect(friendPage).toHaveURL(/\/account\?chat=\d+/)
      await expect(friendPage.getByRole('textbox', { name: 'Сообщение' })).toBeVisible()
    })

    await test.step('переписка доходит в обе стороны без перезагрузки', async () => {
      await ownerPage.getByRole('textbox', { name: 'Сообщение' }).fill('Привет, я в зале!')
      await ownerPage.getByRole('textbox', { name: 'Сообщение' }).press('Enter')
      await expect(friendPage.getByRole('log').getByText('Привет, я в зале!')).toHaveCount(1)
      await friendPage.getByRole('textbox', { name: 'Сообщение' }).fill('Принял, иду')
      await friendPage.getByRole('textbox', { name: 'Сообщение' }).press('Enter')
      await expect(ownerPage.getByRole('log').getByText('Принял, иду')).toHaveCount(1)
    })

    await test.step('онлайн, «печатает…» и «прочитано»', async () => {
      await expect(ownerPage.locator('.chat__members')).toContainText('(в сети)')
      // «печатает…» троттлится на 2,5 с, а друг только что отправлял сообщение
      await friendPage.waitForTimeout(2_600)
      await friendPage.getByRole('textbox', { name: 'Сообщение' }).pressSequentially('набираю')
      await expect(ownerPage.locator('.chat__typing')).toContainText('печатает')
      // без новых нажатий подпись гаснет примерно через 5 секунд
      await expect(ownerPage.locator('.chat__typing')).toHaveText('', { timeout: 10_000 })
      // друг видит чат открытым и в фокусе: сообщение владельца помечается прочитанным
      await expect(ownerPage.locator('.chat__item--mine .chat__read').first()).toBeVisible({
        timeout: 10_000,
      })
    })

    await test.step('картинка уходит и показывается у обоих; плохой файл отклоняется', async () => {
      // 1x1 PNG
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64',
      )
      const input = ownerPage.getByTestId('chat-file')
      await input.setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: png })
      await expect(ownerPage.getByAltText('Превью вложения')).toBeVisible()
      await ownerPage.getByRole('textbox', { name: 'Сообщение' }).fill('Смотри')
      await ownerPage.getByRole('button', { name: 'Отправить', exact: true }).click()
      await expect(friendPage.getByRole('log').getByRole('img', { name: 'Смотри' })).toBeVisible()
      await expect(ownerPage.getByRole('log').getByRole('img', { name: 'Смотри' })).toBeVisible()

      await input.setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('hello'),
      })
      await expect(ownerPage.getByText(/только картинку/)).toBeVisible()
    })

    await test.step('секрет доходит второму участнику, в запросе нет открытого текста', async () => {
      const secretText = 'Steam-пароль: Zebra-4417-лобби'
      const sentBodies: string[] = []
      ownerPage.on('request', (req) => {
        if (req.method() === 'POST' && /\/conversations\/\d+\/messages$/.test(req.url()))
          sentBodies.push(req.postData() ?? '')
      })
      await ownerPage.getByRole('textbox', { name: 'Сообщение' }).fill(secretText)
      await ownerPage.getByRole('button', { name: 'Отправить секретное сообщение' }).click()

      const plaque = friendPage.getByRole('button', {
        name: 'Секретное сообщение, нажми, чтобы показать',
      })
      await expect(plaque).toBeVisible()
      // до нажатия текста на странице нет
      await expect(friendPage.getByText(secretText)).toHaveCount(0)
      await plaque.click()
      await expect(friendPage.getByRole('log').getByText(secretText)).toBeVisible()
      await expect(friendPage.getByText('Скриншот и копирование защитить нельзя.')).toBeVisible()
      await friendPage.getByRole('button', { name: 'Скрыть', exact: true }).click()
      await expect(friendPage.getByText(secretText)).toHaveCount(0)

      expect(sentBodies).toHaveLength(1)
      expect(sentBodies[0]).toContain('"kind":"secret"')
      expect(sentBodies[0]).not.toContain('Zebra')
      expect(sentBodies[0]).not.toContain('Steam')
      expect(sentBodies[0]).not.toContain('4417')
    })

    await test.step('сверка отпечатков показывает 12 групп по 5 цифр', async () => {
      await ownerPage.getByRole('button', { name: 'Проверить участников' }).click()
      const dialog = ownerPage.getByRole('dialog', { name: 'Проверить участников' })
      await expect(dialog.getByText(/(\d{5} ){11}\d{5}/).first()).toBeVisible()
      await dialog.getByRole('button', { name: 'Отметить проверенным' }).first().click()
      await ownerPage.keyboard.press('Escape')
    })

    await test.step('повторное использование ссылки даёт понятную ошибку', async () => {
      const third = await browser.newContext({ baseURL })
      const page = await third.newPage()
      await page.goto('/auth?next=/account', { waitUntil: 'domcontentloaded' })
      await waitForInteractive(page)
      await page.getByLabel('Электронная почта').fill('player@shift.local')
      await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
      await page.getByRole('button', { name: /Войти в SHIFT/ }).click()
      await expect(page).toHaveURL((url) => url.pathname === '/account')
      await page.goto(new URL(inviteUrl).pathname)
      await expect(page.getByRole('alert')).toContainText(/недействительно|не получится/)
      await third.close()
    })
  } finally {
    try {
      if (bookingId !== undefined)
        await admin.request.post(`/api/booking/admin/bookings/${bookingId}/cancel`, {
          headers: await csrf(admin),
        })
    } finally {
      await owner.close()
      await friend.close()
      await admin.close()
    }
  }
})
