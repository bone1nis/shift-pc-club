// Снимает экраны для ручного сравнения «до/после» рефакторинга интерфейса.
//   node tests/visual/capture.mjs <каталог-вывода>
import { chromium, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const out = process.argv[2] ?? '.runtime/shots'
const base = process.env.E2E_BASE_URL ?? 'http://localhost:8088'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()

async function login(page, admin) {
  await page.goto(admin ? '/admin/login' : '/auth?next=/booking', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').waitFor()
  await page.waitForTimeout(800)
  await page
    .getByLabel('Электронная почта')
    .fill(admin ? 'admin@shift.local' : 'player@shift.local')
  await page.getByLabel('Пароль', { exact: true }).fill('ShiftDemo2026!')
  await page.getByRole('button', { name: admin ? /Начать смену/ : /Войти в SHIFT/ }).click()
  await page.waitForURL(admin ? /\/admin\/$/ : /\/booking$/)
}

async function shot(page, name) {
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  console.log('saved', name)
}

for (const [label, options] of [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['mobile', { ...devices['Pixel 7'] }],
]) {
  const anon = await browser.newContext({ ...options, baseURL: base, timezoneId: 'Europe/Moscow' })
  const page = await anon.newPage()
  for (const [name, path] of [
    ['landing', '/'],
    ['auth', '/auth'],
    ['booking-anon', '/booking'],
  ]) {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await shot(page, `${label}-${name}`)
  }
  await login(page, false)
  await shot(page, `${label}-booking`)
  await page.goto('/account', { waitUntil: 'domcontentloaded' })
  await shot(page, `${label}-account`)
  await anon.close()

  const adminCtx = await browser.newContext({
    ...options,
    baseURL: base,
    timezoneId: 'Europe/Moscow',
  })
  const admin = await adminCtx.newPage()
  await login(admin, true)
  for (const section of [
    '',
    'schedule',
    'equipment',
    'tariffs',
    'users',
    'reports',
    'notifications',
    'processing',
    'audit',
  ]) {
    await admin.goto(`/admin/${section}`, { waitUntil: 'domcontentloaded' })
    await shot(admin, `${label}-admin-${section || 'shift'}`)
  }
  await adminCtx.close()
}
await browser.close()
