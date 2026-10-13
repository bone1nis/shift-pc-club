// Снимает скриншоты для руководств (docs/public/screens). Запуск: node tests/visual/docs-screens.mjs
import { chromium } from '@playwright/test'

const base = process.env.E2E_BASE_URL ?? 'http://localhost:8088'
const out = 'docs/public/screens'
const browser = await chromium.launch()

async function login(page, admin) {
  await page.goto(admin ? '/admin/login' : '/auth?next=/account', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').waitFor()
  await page.waitForTimeout(800)
  await page
    .getByLabel('Электронная почта')
    .fill(admin ? 'admin@shift.local' : 'player@shift.local')
  await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
  await page.getByRole('button', { name: admin ? /Начать смену/ : /Войти в SHIFT/ }).click()
  await page.waitForURL(admin ? /\/admin\/$/ : /\/account$/)
}
const settle = (page) => page.waitForTimeout(1500)

const visitor = await (
  await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    baseURL: base,
    timezoneId: 'Europe/Moscow',
  })
).newPage()
await visitor.goto('/', { waitUntil: 'domcontentloaded' })
await settle(visitor)
await visitor.screenshot({ path: `${out}/landing.png` })
await visitor.locator('#contacts').scrollIntoViewIfNeeded()
await settle(visitor)
await visitor.locator('#contacts').screenshot({ path: `${out}/contacts.png` })
await visitor.goto('/booking', { waitUntil: 'domcontentloaded' })
await settle(visitor)
await visitor.getByRole('button', { name: /Когда играем/ }).click()
await settle(visitor)
await visitor.screenshot({ path: `${out}/booking-picker.png` })
await visitor.keyboard.press('Escape')
await visitor
  .getByRole('button', { name: /PC-0[1-9], свободно/ })
  .first()
  .click()
await settle(visitor)
await visitor.screenshot({ path: `${out}/booking-selected.png` })
await login(visitor, false)
await settle(visitor)
await visitor.screenshot({ path: `${out}/account.png` })

const admin = await (
  await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    baseURL: base,
    timezoneId: 'Europe/Moscow',
  })
).newPage()
await login(admin, true)
for (const [name, path] of [
  ['admin-shift', ''],
  ['admin-schedule', 'schedule'],
  ['admin-equipment', 'equipment'],
  ['admin-reports', 'reports'],
  ['admin-club', 'club'],
  ['admin-notifications', 'notifications'],
]) {
  await admin.goto(`/admin/${path}`, { waitUntil: 'domcontentloaded' })
  await settle(admin)
  await admin.screenshot({ path: `${out}/${name}.png` })
}
await browser.close()
