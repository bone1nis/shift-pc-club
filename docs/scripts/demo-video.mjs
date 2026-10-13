// Записывает демо-видео (webm) на запущенном стенде. Запуск: node tests/visual/demo-video.mjs [папка]
import { chromium } from '@playwright/test'

const base = process.env.E2E_BASE_URL ?? 'http://localhost:8088'
const dir = process.argv[2] ?? 'docs/public/demo'
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  baseURL: base,
  timezoneId: 'Europe/Moscow',
  recordVideo: { dir, size: { width: 1280, height: 800 } },
})
const page = await context.newPage()
const pause = (ms = 1500) => page.waitForTimeout(ms)

async function login(admin) {
  await page.goto(admin ? '/admin/login' : '/auth?next=/booking', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').waitFor()
  await pause(800)
  await page
    .getByLabel('Электронная почта')
    .pressSequentially(admin ? 'admin@shift.local' : 'player@shift.local', { delay: 60 })
  await page
    .getByLabel('Пароль', { exact: true })
    .pressSequentially('ShiftDemo2026!', { delay: 60 })
  await pause(600)
  await page.getByRole('button', { name: admin ? /Начать смену/ : /Войти в SHIFT/ }).click()
  await page.waitForURL(admin ? /\/admin\/$/ : /\/booking$/)
  await pause()
}

// Лендинг
await page.goto('/', { waitUntil: 'domcontentloaded' })
await pause(2500)
await page.mouse.wheel(0, 900)
await pause(2000)
await page.mouse.wheel(0, 900)
await pause(2000)

// Игрок: вход и бронь
await login(false)
await page.getByRole('button', { name: '2 ч', exact: true }).click()
await pause()
await page.getByRole('button', { name: /Когда играем/ }).click()
await pause(2000)
await page.keyboard.press('Escape')
await pause(800)
const seat = page.getByRole('button', { name: /PC-\d+, свободно/ }).first()
await seat.scrollIntoViewIfNeeded()
await pause(1200)
await seat.click()
await pause(1500)
const [created] = await Promise.all([
  page.waitForResponse(
    (r) => r.url().endsWith('/api/booking/bookings') && r.request().method() === 'POST',
  ),
  page.getByRole('button', { name: /Подтвердить бронь/ }).click(),
])
const bookingId = (await created.json()).data.id
await page.waitForURL(/\/account/)
await pause(3000)

// Администратор: заселение и отчёты
await context.clearCookies()
await login(true)
await page.goto('/admin/schedule', { waitUntil: 'domcontentloaded' })
await pause(2000)
const row = page
  .getByRole('row')
  .filter({ has: page.getByRole('cell', { name: `#${bookingId}`, exact: true }) })
await row.scrollIntoViewIfNeeded()
await pause(1000)
await row.getByRole('button', { name: 'Заселить', exact: true }).click()
await pause(2500)
await page.goto('/admin/', { waitUntil: 'domcontentloaded' })
await pause(3000)
await page.goto('/admin/reports', { waitUntil: 'domcontentloaded' })
await pause(3000)

await context.close()
await browser.close()
