/* global Buffer, sessionStorage, addEventListener, performance, requestAnimationFrame */
// Записывает демо-видео (webm, 1080p) на запущенном стенде.
// Запуск: node docs/scripts/demo-video.mjs [файл.webm]  (по умолчанию docs/public/demo/demo.webm)
// Кадры берутся через CDP screencast (JPEG, высокое качество) и кодируются ffmpeg из Playwright (VP9).
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const base = process.env.E2E_BASE_URL ?? 'http://localhost:8088'
const outFile = process.argv[2] ?? 'docs/public/demo/demo.webm'
const FPS = Number(process.env.FPS ?? 60)
const W = 1920
const H = 1080

const cache = join(homedir(), 'Library/Caches/ms-playwright')
const ffmpegDir = readdirSync(cache).find((d) => d.startsWith('ffmpeg-'))
const ffmpeg = process.env.FFMPEG ?? join(cache, ffmpegDir, 'ffmpeg-mac')

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: W, height: H },
  baseURL: base,
  timezoneId: 'Europe/Moscow',
})
// Курсор в кадре: Playwright его не рисует, поэтому добавляем свой.
await context.addInitScript(() => {
  const add = () => {
    const c = document.createElement('div')
    c.style.cssText =
      'position:fixed;z-index:2147483647;pointer-events:none;width:26px;height:26px;left:0;top:0;transition:transform 40ms linear'
    c.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 2l17 8-7 2-3 7z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    document.documentElement.appendChild(c)
    let last = { x: 0, y: 0 }
    try {
      last = JSON.parse(sessionStorage.getItem('demo-cursor') ?? 'null') ?? last
    } catch {
      /* sessionStorage недоступен — курсор просто начнёт с угла */
    }
    c.style.transform = `translate(${last.x}px,${last.y}px)`
    addEventListener(
      'mousemove',
      (e) => {
        c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`
        try {
          sessionStorage.setItem('demo-cursor', JSON.stringify({ x: e.clientX, y: e.clientY }))
        } catch {
          /* sessionStorage недоступен — курсор просто начнёт с угла */
        }
      },
      true,
    )
  }
  if (document.documentElement) add()
  else addEventListener('DOMContentLoaded', add)
})

const page = await context.newPage()
const frames = []
const cdp = await context.newCDPSession(page)
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ t: f.metadata.timestamp, buf: Buffer.from(f.data, 'base64') })
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
})
// Запись начинается только после полной загрузки страницы, чтобы в начале не было белого кадра.
await page.goto('/', { waitUntil: 'load' })
await page.waitForTimeout(1500)
await cdp.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 92,
  maxWidth: W,
  maxHeight: H,
  everyNthFrame: 1,
})

const pause = (ms = 1200) => page.waitForTimeout(ms)
let pos = { x: W / 2, y: H / 2 }

async function moveTo(x, y) {
  await page.mouse.move(x, y, { steps: 35 })
  pos = { x, y }
}
async function click(locator) {
  await locator.scrollIntoViewIfNeeded()
  await pause(500)
  const b = await locator.boundingBox()
  await moveTo(b.x + b.width / 2, b.y + b.height / 2)
  await pause(350)
  await page.mouse.click(pos.x, pos.y)
}
// Плавная прокрутка с ускорением и замедлением.
async function scroll(dy, ms = 2500) {
  await page.evaluate(
    ([dy, ms]) =>
      new Promise((resolve) => {
        const start = performance.now()
        let done = 0
        const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
        const step = (now) => {
          const t = Math.min(1, (now - start) / ms)
          const target = dy * ease(t)
          window.scrollBy(0, target - done)
          done = target
          if (t < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      }),
    [dy, ms],
  )
  await pause(600)
}
async function type(label, text, opts = {}) {
  const field = page.getByLabel(label, opts)
  await click(field)
  await field.pressSequentially(text, { delay: 70 })
}
async function login(admin) {
  await page.goto(admin ? '/admin/login' : '/auth?next=/booking', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').waitFor()
  await pause(1500)
  await type('Электронная почта', admin ? 'admin@shift.local' : 'player@shift.local')
  await type('Пароль', 'ShiftDemo2026!', { exact: true })
  await pause(500)
  await click(page.getByRole('button', { name: admin ? /Начать смену/ : /Войти в SHIFT/ }))
  await page.waitForURL(admin ? /\/admin\/$/ : /\/booking$/)
  await pause(1800)
}

// 1. Лендинг
await pause(2500)
await scroll(1500, 4000)
await scroll(1500, 4000)
await scroll(1200, 3500)
await scroll(-4200, 3500)
await pause(800)

// 2. Игрок: вход и бронь
await login(false)
await click(page.getByRole('button', { name: '2 ч', exact: true }))
await pause(800)
await click(page.getByRole('button', { name: /Когда играем/ }))
await pause(2500)
await page.keyboard.press('Escape')
await pause(800)
await scroll(450, 2000)
const seat = page.getByRole('button', { name: /PC-\d+, свободно/ }).first()
await click(seat)
await pause(1500)
await scroll(400, 1800)
const confirm = page.getByRole('button', { name: /Подтвердить бронь/ })
const [created] = await Promise.all([
  page.waitForResponse(
    (r) => r.url().endsWith('/api/booking/bookings') && r.request().method() === 'POST',
  ),
  click(confirm),
])
const bookingId = (await created.json()).data.id
await page.waitForURL(/\/account/)
await pause(2500)
await scroll(600, 2200)
await pause(1500)
await scroll(-600, 1800)

// 3. Администратор: заселение, смена, отчёты
await context.clearCookies()
await login(true)
await scroll(500, 2000)
await pause(1200)
await scroll(-500, 1500)
await click(page.getByRole('link', { name: 'Расписание', exact: true }).first())
await pause(2500)
const row = page
  .getByRole('row')
  .filter({ has: page.getByRole('cell', { name: `#${bookingId}`, exact: true }) })
await click(row.getByRole('button', { name: 'Заселить', exact: true }))
await pause(3000)
await click(page.getByRole('link', { name: 'Смена', exact: true }).first())
await pause(2500)
await scroll(500, 2000)
await pause(1500)
await click(page.getByRole('link', { name: 'Отчёты', exact: true }).first())
await pause(2500)
await scroll(600, 2200)
await pause(2500)

await cdp.send('Page.stopScreencast')
await browser.close()

// Ровные 30 кадров/с из кадров screencast (последний известный кадр держится до следующего).
mkdirSync(dirname(outFile), { recursive: true })
const ff = spawn(
  ffmpeg,
  [
    '-y',
    '-f',
    'image2pipe',
    '-framerate',
    String(FPS),
    '-c:v',
    'mjpeg',
    '-i',
    'pipe:0',
    '-c:v',
    'libvpx-vp9',
    '-crf',
    process.env.CRF ?? '32',
    '-b:v',
    process.env.BITRATE ?? '0',
    '-pix_fmt',
    'yuv420p',
    '-row-mt',
    '1',
    outFile,
  ],
  { stdio: ['pipe', 'ignore', 'inherit'] },
)
const t0 = frames[0].t
const total = Math.ceil((frames.at(-1).t - t0) * FPS)
let k = 0
for (let i = 0; i <= total; i++) {
  const t = t0 + i / FPS
  while (k + 1 < frames.length && frames[k + 1].t <= t) k++
  if (!ff.stdin.write(frames[k].buf)) await new Promise((r) => ff.stdin.once('drain', r))
}
ff.stdin.end()
await new Promise((r) => ff.on('close', r))
const perSecond = {}
for (const f of frames) {
  const sec = Math.floor(f.t - t0)
  perSecond[sec] = (perSecond[sec] ?? 0) + 1
}
console.log('Максимум кадров в секунду от браузера:', Math.max(...Object.values(perSecond)))
console.log(`Готово: ${outFile} (${(total / FPS).toFixed(1)} с, ${frames.length} кадров)`)
