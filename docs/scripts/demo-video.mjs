/* global Buffer, sessionStorage, addEventListener, getComputedStyle, Image, performance, requestAnimationFrame, scrollY, createImageBitmap, Blob, atob */
// Записывает короткие демо-клипы (webm + превью webp) на запущенном стенде.
// Запуск: node docs/scripts/demo-video.mjs [номер|имя клипа ...]
//   без аргументов — все клипы; `05` или `chat` — только один (можно несколько через пробел).
// Результат: docs/public/demo/clips/NN-name.webm и NN-name.webp (анимированное превью 800 px для README).
// Кадры берутся через CDP screencast (JPEG), двойные клипы склеиваются в странице-компоновщике (canvas),
// кодирует ffmpeg из Playwright (VP9; в нём нет hstack/overlay, поэтому склейка делается в браузере).
// Параметры окружения: E2E_BASE_URL, OUT_DIR, FPS (одиночные, 60), DUAL_FPS (двойные, 30), CRF (38), JPEG_QUALITY (85),
// PREVIEW_FPS (10), PREVIEW_WIDTH (800, у двойных 1000), PREVIEW_QUALITY (стартовое качество webp, 55), PREVIEW_MAX_KB (2500), CLIP_MAX_KB (3000).
import { chromium } from '@playwright/test'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const base = process.env.E2E_BASE_URL ?? 'http://localhost:8088'
const outDir = process.env.OUT_DIR ?? 'docs/public/demo/clips'
const PASSWORD = 'ShiftDemo2026!'
const SINGLE = { w: 1920, h: 1080, fps: Number(process.env.FPS ?? 60) }
// Двойной кадр 1920x1080: полоса подписей 32 px + две панели по 960x1048 без уменьшения.
// Ширина панели больше 800 px, иначе админка рисуется в мобильной раскладке.
const DUAL = { pw: 960, ph: 1048, fps: Number(process.env.DUAL_FPS ?? 30), label: 32 }
const DUAL_FRAME = { w: DUAL.pw * 2, h: DUAL.ph + 32 }

const cache = join(homedir(), 'Library/Caches/ms-playwright')
const ffmpegDir = readdirSync(cache).find((d) => d.startsWith('ffmpeg-'))
const ffmpeg = process.env.FFMPEG ?? join(cache, ffmpegDir, 'ffmpeg-mac')

const browser = await chromium.launch()

// ---------- общие помощники ----------

const cursorScript = () => {
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
}

async function newContext(viewport, storageState) {
  const context = await browser.newContext({
    viewport,
    baseURL: base,
    timezoneId: 'Europe/Moscow',
    storageState,
  })
  await context.addInitScript(cursorScript)
  return context
}

async function waitInteractive(page) {
  await page.waitForFunction(() => {
    const nuxt = window.useNuxtApp
    if (nuxt) return nuxt().isHydrating === false
    return Boolean(document.querySelector('#app')?.children.length)
  })
}

// Прогрев: ленивые картинки и фоны загружаем и декодируем заранее, иначе в кадре случаются подвисания.
async function warm(page) {
  await page.evaluate(async () => {
    const urls = new Set()
    for (const img of document.images) {
      img.loading = 'eager'
      urls.add(img.currentSrc || img.src)
    }
    for (const el of document.querySelectorAll('*')) {
      for (const m of getComputedStyle(el).backgroundImage.matchAll(/url\("?([^")]+)"?\)/g))
        urls.add(m[1])
    }
    await Promise.all(
      [...urls].map((u) => {
        const i = new Image()
        i.src = u
        return i.decode().catch(() => {})
      }),
    )
  })
}

// Запись кадров страницы.
async function startRec(page, w, h) {
  const frames = []
  const cdp = await page.context().newCDPSession(page)
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ t: f.metadata.timestamp, buf: Buffer.from(f.data, 'base64') })
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: Number(process.env.JPEG_QUALITY ?? 85),
    maxWidth: w,
    maxHeight: h,
    everyNthFrame: 1,
  })
  return {
    frames,
    async stop() {
      await cdp.send('Page.stopScreencast').catch(() => {})
    },
  }
}

// «Рука» над страницей: плавный курсор, клики, прокрутка, набор текста.
function hand(page, size, fast = false) {
  let pos = { x: size.w / 2, y: size.h / 2 }
  const pause = (ms = 1200) => page.waitForTimeout(ms)
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
  async function moveTo(x, y) {
    const from = pos
    const dist = Math.hypot(x - from.x, y - from.y)
    const steps = fast
      ? Math.max(8, Math.min(28, Math.round(dist / 24)))
      : Math.max(10, Math.min(50, Math.round(dist / 20)))
    for (let i = 1; i <= steps; i++) {
      const e = ease(i / steps)
      await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e)
      await page.waitForTimeout(16)
    }
    pos = { x, y }
  }
  async function click(locator, opts = {}) {
    const quick = opts.quick || fast
    await locator.scrollIntoViewIfNeeded()
    await pause(quick ? 150 : 400)
    const b = await locator.boundingBox()
    await moveTo(b.x + b.width / 2, b.y + b.height / 2)
    await pause(quick ? 120 : 300)
    await page.mouse.click(pos.x, pos.y)
  }
  async function scroll(dy, ms = 2000, settle = 400) {
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
    await pause(settle)
  }
  async function scrollTo(y, ms = 2000, settle = 400) {
    await scroll(y - (await page.evaluate(() => window.scrollY)), ms, settle)
  }
  async function type(locator, text, delay = 55) {
    await click(locator, { quick: true })
    await locator.pressSequentially(text, { delay })
  }
  return { pause, moveTo, click, scroll, scrollTo, type, pos: () => pos }
}

// Вход без записи (подготовка сценария).
async function loginAdmin(page, email = 'admin@shift.local') {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await waitInteractive(page)
  await page.getByLabel('Электронная почта').fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: /Начать смену/ }).click()
  await page.waitForURL(/\/admin\/$/)
}

// Новый аккаунт игрока (e2e-demo-*): регистрируется без записи, возвращает storageState с сессией.
async function registerPlayer(name, prefix = 'player') {
  const email = `e2e-demo-${prefix}-${Date.now()}@shift.local`
  const reg = await browser.newContext({ baseURL: base, timezoneId: 'Europe/Moscow' })
  try {
    const page = await reg.newPage()
    await page.goto('/auth?next=/account', { waitUntil: 'domcontentloaded' })
    await waitInteractive(page)
    await page.getByRole('tab', { name: /Регистрация/ }).click()
    await page.getByLabel('Имя').fill(name)
    await page.getByLabel('Электронная почта').fill(email)
    await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD)
    const confirm = page.getByLabel('Повторите пароль')
    if (await confirm.count()) await confirm.fill(PASSWORD)
    await page.getByRole('button', { name: /Создать|Зарегистр/ }).click()
    await page.waitForURL((url) => url.pathname === '/account')
    return await reg.storageState()
  } finally {
    await reg.close()
  }
}

async function csrf(context) {
  const cookie = (await context.cookies(base)).find((c) => c.name === 'XSRF-TOKEN')
  if (!cookie) throw new Error('нет CSRF cookie')
  return { Origin: new URL(base).origin, 'X-CSRF-TOKEN': decodeURIComponent(cookie.value) }
}

// Свободное место и окно времени через N суток, создание брони от имени игрока (через API, до записи).
const MOSCOW = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const moscow = (ms) => MOSCOW.format(ms).replace(' ', 'T')

// Первое окно на `hours` часов, начиная через `days` суток (шаг 1 ч), где свободно не меньше `minFree` мест.
async function findSlot(context, days, hours, minFree) {
  const half = 30 * 60_000
  const start = Math.ceil((Date.now() + days * 24 * 3_600_000) / half) * half
  for (let shift = 0; shift < 72; shift++) {
    const startsAt = start + shift * 3_600_000
    const free = (
      await (
        await context.request.get('/api/booking/availability', {
          params: {
            starts_at: new Date(startsAt).toISOString(),
            ends_at: new Date(startsAt + hours * 3_600_000).toISOString(),
          },
        })
      ).json()
    ).data
    if (free.filter((a) => a.available).length >= minFree) return startsAt
  }
  throw new Error('нет окна со свободными местами')
}

async function createBooking(context, days) {
  const half = 30 * 60_000
  const catalog = (await (await context.request.get('/api/club/catalog')).json()).data
  const start = Math.ceil((Date.now() + days * 24 * 3_600_000) / half) * half
  for (let shift = 0; shift < 12; shift++) {
    const startsAt = start + shift * 2 * 3_600_000
    const free = (
      await (
        await context.request.get('/api/booking/availability', {
          params: {
            starts_at: new Date(startsAt).toISOString(),
            ends_at: new Date(startsAt + 3_600_000).toISOString(),
          },
        })
      ).json()
    ).data
    const ws = catalog.workstations.find((w) =>
      free.some((a) => a.workstation_id === w.id && a.available),
    )
    if (!ws) continue
    const created = await context.request.post('/api/booking/bookings', {
      headers: { ...(await csrf(context)), 'Idempotency-Key': crypto.randomUUID() },
      data: {
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(startsAt + 3_600_000).toISOString(),
        workstation_ids: [ws.id],
      },
    })
    if (created.status() !== 201) throw new Error(`бронь не создана: ${created.status()}`)
    return (await created.json()).data.id
  }
  throw new Error('нет свободных мест')
}

// Администратор для API-действий (отмена своих демо-броней, завершение своих демо-сессий).
async function adminApi() {
  const context = await newContext({ width: 1280, height: 800 })
  const page = await context.newPage()
  await loginAdmin(page)
  return {
    context,
    page,
    cancelBooking: async (id) =>
      (
        await context.request.post(`/api/booking/admin/bookings/${id}/cancel`, {
          headers: await csrf(context),
        })
      ).status(),
    endSession: async (id) =>
      (
        await context.request.post(`/api/booking/admin/sessions/${id}/end`, {
          headers: await csrf(context),
        })
      ).status(),
    close: () => context.close(),
  }
}

// ---------- кодирование ----------

const clipPath = (name, ext) => join(outDir, `${name}.${ext}`)

function encodeVideo(name, frameAt, total, fps) {
  return new Promise((resolve, reject) => {
    const out = clipPath(name, 'webm')
    const crf = process.env.CRF ?? '38'
    const ff = spawn(
      ffmpeg,
      [
        '-y',
        '-loglevel',
        'error',
        '-f',
        'image2pipe',
        '-framerate',
        String(fps),
        '-c:v',
        'mjpeg',
        '-i',
        'pipe:0',
        '-c:v',
        'libvpx-vp9',
        '-crf',
        crf,
        '-b:v',
        '0',
        '-pix_fmt',
        'yuv420p',
        '-row-mt',
        '1',
        out,
      ],
      { stdio: ['pipe', 'ignore', 'inherit'] },
    )
    ff.on('error', reject)
    ff.on('close', () => resolve(out))
    ;(async () => {
      for (let i = 0; i < total; i++) {
        const buf = await frameAt(i)
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
      }
      ff.stdin.end()
    })().catch(reject)
  })
}

// Превью для README: анимированный webp шириной 800 px, качество подбирается под лимит размера.
function makePreview(name, samples, width = Number(process.env.PREVIEW_WIDTH ?? 800)) {
  const dir = mkdtempSync(join(tmpdir(), 'demo-preview-'))
  try {
    const files = samples.map((buf, i) => {
      const f = join(dir, `f${String(i).padStart(4, '0')}.jpg`)
      writeFileSync(f, buf)
      return f
    })
    const maxKb = Number(process.env.PREVIEW_MAX_KB ?? 2500)
    let q = Number(process.env.PREVIEW_QUALITY ?? 55)
    const out = clipPath(name, 'webp')
    for (;;) {
      const webps = files.map((f) => {
        const w = f.replace(/\.jpg$/, '.webp')
        const r = spawnSync('cwebp', [
          '-quiet',
          '-q',
          String(q),
          '-resize',
          String(width),
          '0',
          f,
          '-o',
          w,
        ])
        if (r.status !== 0) throw new Error(`cwebp: ${r.stderr}`)
        return w
      })
      const delay = Math.round(1000 / Number(process.env.PREVIEW_FPS ?? 10))
      const r = spawnSync('img2webp', [
        '-loop',
        '0',
        '-d',
        String(delay),
        '-lossy',
        '-q',
        String(q),
        '-m',
        '4',
        ...webps,
        '-o',
        out,
      ])
      if (r.status !== 0) throw new Error(`img2webp: ${r.stderr}`)
      const kb = statSync(out).size / 1024
      if (kb <= maxKb || q <= 15) return { kb, q }
      q -= 8
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// Индекс последнего кадра с t <= заданного времени (бинарный поиск, можно вызывать в любом порядке).
const frameIndexer = (frames) => (t) => {
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (frames[mid].t <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

function endTime(recs) {
  const last = Math.max(...recs.map((r) => r.frames.at(-1).t))
  const now = Date.now() / 1000
  // timestamp у screencast — время с эпохи: если часы совпадают, держим последний кадр до момента остановки записи.
  return Math.abs(now - last) < 30 ? Math.max(last, now) : last
}

async function finishSingle(name, rec) {
  await rec.stop()
  const { frames } = rec
  const t0 = frames[0].t
  const fps = SINGLE.fps
  const total = Math.ceil((endTime([rec]) - t0) * fps)
  const idx = frameIndexer(frames)
  const frameAt = async (i) => frames[idx(t0 + i / fps)].buf
  mkdirSync(outDir, { recursive: true })
  await encodeVideo(name, frameAt, total, fps)
  const prevFps = Number(process.env.PREVIEW_FPS ?? 10)
  const prevIdx = frameIndexer(frames)
  const samples = []
  for (let i = 0; i < Math.floor((total / fps) * prevFps); i++)
    samples.push(frames[prevIdx(t0 + i / prevFps)].buf)
  return report(
    name,
    total / fps,
    makePreview(name, samples, Number(process.env.PREVIEW_WIDTH ?? 1000)),
  )
}

// Двойной кадр собирается в странице-компоновщике (canvas): слева recL, справа recR.
async function finishDual(name, labels, recL, recR) {
  await Promise.all([recL.stop(), recR.stop()])
  const t0 = Math.max(recL.frames[0].t, recR.frames[0].t)
  const fps = DUAL.fps
  const total = Math.ceil((endTime([recL, recR]) - t0) * fps)
  const comp = await browser.newPage({ viewport: { width: DUAL_FRAME.w, height: DUAL_FRAME.h } })
  await comp.setContent(`<canvas id="c" width="${DUAL_FRAME.w}" height="${DUAL_FRAME.h}"></canvas>`)
  const load = async (key, frames) => {
    for (let i = 0; i < frames.length; i += 40) {
      await comp.evaluate(
        async ([key, list, start]) => {
          window[key] ??= []
          for (const [n, b64] of list.entries()) {
            const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
            window[key][start + n] = await createImageBitmap(
              new Blob([bin], { type: 'image/jpeg' }),
            )
          }
        },
        [key, frames.slice(i, i + 40).map((f) => f.buf.toString('base64')), i],
      )
    }
  }
  await load('L', recL.frames)
  await load('R', recR.frames)
  const idxL = frameIndexer(recL.frames)
  const idxR = frameIndexer(recR.frames)
  const draw = (t) => {
    const l = idxL(t)
    const r = idxR(t)
    return comp.evaluate(
      ([l, r, labels, lh, pw, ph]) => {
        const c = document.getElementById('c')
        const x = c.getContext('2d')
        x.fillStyle = '#0d1117'
        x.fillRect(0, 0, 2 * pw, ph + lh)
        x.drawImage(window.L[l], 0, lh, pw, ph)
        x.drawImage(window.R[r], pw, lh, pw, ph)
        x.fillStyle = '#fff'
        x.font = '600 24px -apple-system, Helvetica, Arial, sans-serif'
        x.textBaseline = 'middle'
        x.fillText(labels[0], 14, lh / 2)
        x.fillText(labels[1], pw + 14, lh / 2)
        x.fillStyle = '#3b4252'
        x.fillRect(pw - 1, 0, 2, ph + lh)
        return c.toDataURL('image/jpeg', 0.88).slice('data:image/jpeg;base64,'.length)
      },
      [l, r, labels, DUAL.label, DUAL.pw, DUAL.ph],
    )
  }
  mkdirSync(outDir, { recursive: true })
  const frameAt = async (i) => Buffer.from(await draw(t0 + i / fps), 'base64')
  await encodeVideo(name, frameAt, total, fps)
  const prevFps = Number(process.env.PREVIEW_FPS ?? 10)
  const samples = []
  for (let i = 0; i < Math.floor((total / fps) * prevFps); i++)
    samples.push(Buffer.from(await draw(t0 + i / prevFps), 'base64'))
  await comp.close()
  return report(name, total / fps, makePreview(name, samples))
}

function report(name, seconds, preview) {
  const kb = statSync(clipPath(name, 'webm')).size / 1024
  const line = `${name}: ${seconds.toFixed(1)} с, webm ${kb.toFixed(0)} КБ, webp ${preview.kb.toFixed(0)} КБ (q${preview.q})`
  console.log(line)
  if (kb > Number(process.env.CLIP_MAX_KB ?? 3000))
    console.log(`  ВНИМАНИЕ: webm больше лимита, увеличьте CRF (сейчас ${process.env.CRF ?? 38})`)
  return line
}

// ---------- клипы ----------

async function singleClip(name, setup, scenario, cleanup = async () => {}) {
  const context = await newContext({ width: SINGLE.w, height: SINGLE.h })
  const page = await context.newPage()
  const state = {}
  try {
    const start = await setup(page, context, state)
    await page.goto(start, { waitUntil: 'load' })
    await waitInteractive(page)
    await warm(page)
    await page.waitForTimeout(1000)
    const rec = await startRec(page, SINGLE.w, SINGLE.h)
    const h = hand(page, { w: SINGLE.w, h: SINGLE.h })
    await scenario(page, h, state, context).catch(async (e) => {
      if (process.env.DEBUG_DIR)
        await page.screenshot({ path: join(process.env.DEBUG_DIR, `${name}.png`) })
      throw e
    })
    await h.pause(1200)
    return await finishSingle(name, rec)
  } finally {
    await cleanup(state)
    await context.close()
  }
}

// Двойной клип: setup создаёт страницы и возвращает { left, right } с { page, start }, сценарий получает обе «руки».
async function dualClip(name, labels, setup, scenario, cleanup = async () => {}) {
  const state = { contexts: [] }
  try {
    const { left, right } = await setup(state)
    const size = { w: DUAL.pw, h: DUAL.ph }
    for (const side of [left, right]) {
      await side.page.setViewportSize({ width: DUAL.pw, height: DUAL.ph })
      await side.page.goto(side.start, { waitUntil: 'load' })
      await waitInteractive(side.page)
      await warm(side.page)
      await side.after?.(side.page)
    }
    await left.page.waitForTimeout(1000)
    const recL = await startRec(left.page, DUAL.pw, DUAL.ph)
    const recR = await startRec(right.page, DUAL.pw, DUAL.ph)
    const hl = hand(left.page, size, true)
    const hr = hand(right.page, size, true)
    await scenario(left.page, hl, right.page, hr, state).catch(async (e) => {
      if (process.env.DEBUG_DIR) {
        await left.page.screenshot({ path: join(process.env.DEBUG_DIR, `${name}-L.png`) })
        await right.page.screenshot({ path: join(process.env.DEBUG_DIR, `${name}-R.png`) })
      }
      throw e
    })
    await hl.pause(1200)
    return await finishDual(name, labels, recL, recR)
  } finally {
    await cleanup(state)
    for (const c of state.contexts) await c.close().catch(() => {})
  }
}

async function dualContext(state, storageState) {
  const c = await newContext({ width: DUAL.pw, height: DUAL.ph }, storageState)
  state.contexts.push(c)
  return c
}

const clips = {}

// 01. Лендинг: быстрый обход блоков.
clips['01-landing'] = () =>
  singleClip(
    '01-landing',
    async () => '/',
    async (page, h) => {
      await h.pause(800)
      const blocks = await page.evaluate(() =>
        [...document.querySelectorAll('main section, footer')]
          .filter((el) => !el.parentElement.closest('section'))
          .map((el) => {
            const r = el.getBoundingClientRect()
            return { top: Math.round(r.top + scrollY), height: Math.round(r.height) }
          }),
      )
      const per = Math.max(700, Math.min(1500, 6000 / Math.max(1, blocks.length - 1)))
      console.log(`блоков на лендинге: ${blocks.length}, на блок ${Math.round(per)} мс`)
      for (const [i, b] of blocks.entries()) {
        if (i === 0) continue
        await h.scrollTo(b.top - 100, per * 0.6, 60)
        if (b.height > SINGLE.h - 140)
          await h.scrollTo(b.top + b.height - SINGLE.h + 40, per * 0.5, 60)
        await h.pause(per * 0.3)
      }
    },
  )

// 02. Бронь: места, время, подтверждение, кабинет.
clips['02-booking'] = () =>
  singleClip(
    '02-booking',
    async (page, context, state) => {
      // Свежий аккаунт: в кабинете нет чужих сессий, бронь видна сразу.
      await context.addCookies((await registerPlayer('Дмитрий', 'booker')).cookies)
      state.slot = await findSlot(context, 5, 2, 3)
      state.admin = await adminApi()
      return '/booking'
    },
    async (page, h, state) => {
      const [date, time] = moscow(state.slot).split('T')
      await h.pause(300)
      await h.click(page.getByRole('button', { name: '2 ч', exact: true }))
      await h.pause(400)
      await h.click(page.getByRole('button', { name: /Когда играем/ }))
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      const day = dialog.locator(`[data-date="${date}"]`)
      for (let i = 0; i < 3 && !(await day.isVisible()); i++)
        await h.click(dialog.getByRole('button', { name: 'Следующий месяц' }), { quick: true })
      await h.click(day, { quick: true })
      await h.pause(300)
      await h.click(dialog.getByRole('option', { name: time, exact: true }), { quick: true })
      await h.pause(500)
      await page.keyboard.press('Escape')
      await h.pause(500)
      await h.scroll(420, 900)
      // Арена занята зависшими демо-сессиями, свободны места VIP.
      const vip = page.locator('button, [role=tab]').filter({ hasText: /^VIP/ })
      if (await vip.count()) await h.click(vip.first(), { quick: true })
      await h.pause(500)
      const seats = page.getByRole('button', { name: /(PC|VIP)-\d+, свободно/ })
      const [seatA, seatB] = await seats.all()
      await h.click(seatA, { quick: true })
      await h.pause(250)
      await h.click(seatB, { quick: true })
      await h.pause(600)
      await h.scroll(300, 800)
      const [created] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().endsWith('/api/booking/bookings') && r.request().method() === 'POST',
        ),
        h.click(page.getByRole('button', { name: /Подтвердить бронь/ }), { quick: true }),
      ])
      state.bookingId = (await created.json()).data.id
      await page.waitForURL(/\/account/)
      await h.pause(1300)
      const card = page.locator('.booking-card').filter({ hasText: `Бронь #${state.bookingId}` })
      await card.scrollIntoViewIfNeeded()
      await h.pause(1500)
    },
    async (state) => {
      if (state.bookingId && state.admin) await state.admin.cancelBooking(state.bookingId)
      await state.admin?.close()
    },
  )

// 03. Realtime в кабинете: слева игрок, справа админка; отмена появляется у игрока без перезагрузки.
clips['03-realtime-cabinet'] = () =>
  dualClip(
    '03-realtime-cabinet',
    ['Игрок: кабинет', 'Администратор: расписание'],
    async (state) => {
      const pc = await dualContext(state, await registerPlayer('Игорь', 'cabinet'))
      const ac = await dualContext(state)
      const pp = await pc.newPage()
      const ap = await ac.newPage()
      await loginAdmin(ap)
      state.admin = await adminApi()
      state.bookingId = await createBooking(pc, 5)
      return {
        left: { page: pp, start: '/account' },
        right: { page: ap, start: '/admin/schedule' },
      }
    },
    async (pp, hl, ap, hr, state) => {
      const card = pp.locator('.booking-card').filter({ hasText: `Бронь #${state.bookingId}` })
      await card.waitFor()
      await card.evaluate((el) => el.scrollIntoView({ block: 'center' }))
      const row = ap
        .getByRole('row')
        .filter({ has: ap.getByRole('cell', { name: `#${state.bookingId}`, exact: true }) })
      await row.scrollIntoViewIfNeeded().catch(() => {})
      await hl.moveTo(300, 300)
      await hl.pause(1200)
      const b = await row.boundingBox().catch(() => null)
      if (b) await hr.moveTo(b.x + b.width / 2, b.y + b.height / 2)
      await hr.pause(1800)
      // Администратор отменяет бронь (запрос API), страница игрока обновляется сама.
      await state.admin.cancelBooking(state.bookingId)
      state.cancelled = true
      await card.getByText('Отменена', { exact: true }).waitFor({ timeout: 20_000 })
      await hl.pause(2500)
    },
    async (state) => {
      if (state.bookingId && !state.cancelled) await state.admin?.cancelBooking(state.bookingId)
      await state.admin?.close()
    },
  )

// 04. Карта зала: слева администратор заселяет гостя, справа открытая «Смена» обновляется сама.
clips['04-hall-live'] = () =>
  dualClip(
    '04-hall-live',
    ['Окно 1: расписание, заселение', 'Окно 2: карта зала (без перезагрузки)'],
    async (state) => {
      const c1 = await dualContext(state)
      const c2 = await dualContext(state)
      const p1 = await c1.newPage()
      const p2 = await c2.newPage()
      await loginAdmin(p1)
      await loginAdmin(p2)
      state.admin = await adminApi()
      return {
        left: { page: p1, start: '/admin/schedule' },
        right: { page: p2, start: '/admin/' },
      }
    },
    async (p1, hl, p2, hr, state) => {
      await hr.moveTo(560, 300)
      await hl.pause(900)
      await hl.click(p1.getByRole('button', { name: /Свободное место/ }))
      await hl.click(p1.getByRole('option').first())
      await hl.click(p1.getByRole('button', { name: /Время/ }))
      await hl.click(p1.getByRole('option', { name: '60 мин', exact: true }))
      const start = p1.getByRole('button', { name: 'Начать сессию' })
      await start.waitFor()
      const [created] = await Promise.all([
        p1.waitForResponse(
          (r) => r.url().endsWith('/api/booking/admin/sessions') && r.request().method() === 'POST',
        ),
        hl.click(start),
      ])
      state.sessionId = (await created.json()).data.id
      const tile = p2
        .locator('article')
        .filter({ hasText: new RegExp(`Сессия №${state.sessionId} ·`) })
      await tile.waitFor({ timeout: 15_000 })
      await hr.pause(2800)
    },
    async (state) => {
      if (state.sessionId) await state.admin?.endSession(state.sessionId)
      await state.admin?.close()
    },
  )

// 05. Чат брони: слева владелец, справа приглашённый друг.
clips['05-chat'] = () =>
  dualClip(
    '05-chat',
    ['Владелец брони', 'Приглашённый друг'],
    async (state) => {
      const pc = await dualContext(state, await registerPlayer('Олег', 'owner'))
      const pp = await pc.newPage()
      state.admin = await adminApi()
      state.bookingId = await createBooking(pc, 5)
      for (let i = 0; i < 40; i++) {
        if (
          (await pc.request.get(`/api/realtime/conversations/${state.bookingId}`)).status() === 200
        )
          break
        await pp.waitForTimeout(1000)
      }
      // Друг: новый аккаунт, регистрируется заранее (без записи) и остаётся в системе.
      const storage = await registerPlayer('Анна', 'friend')
      const fc = await dualContext(state, storage)
      const fp = await fc.newPage()
      return {
        left: { page: pp, start: '/account' },
        right: { page: fp, start: '/account' },
      }
    },
    async (pp, hl, fp, hr, state) => {
      const card = pp.locator('.booking-card').filter({ hasText: `Бронь #${state.bookingId}` })
      await card.waitFor()
      await hl.pause(600)
      await hl.click(card.getByRole('button', { name: 'Чат', exact: true }), { quick: true })
      await pp.getByText('Чат модерируется администратором клуба.').waitFor()
      await hl.pause(500)
      await hl.click(pp.getByRole('button', { name: 'Пригласить друга' }), { quick: true })
      const field = pp.getByLabel('Ссылка-приглашение')
      await field.waitFor()
      await hl.pause(1000)
      const url = new URL(await field.inputValue())
      // Друг открывает ссылку-приглашение и попадает в чат.
      await fp.goto(url.pathname, { waitUntil: 'domcontentloaded' })
      await fp.waitForURL(/\/account\?chat=\d+/)
      const fBox = fp.getByRole('textbox', { name: 'Сообщение' })
      await fBox.waitFor()
      await hr.pause(400)
      // Переписка.
      const oBox = pp.getByRole('textbox', { name: 'Сообщение' })
      await hl.type(oBox, 'Привет, я в зале!', 30)
      await oBox.press('Enter')
      await fp.getByRole('log').getByText('Привет, я в зале!').waitFor()
      await hr.pause(500)
      await hr.type(fBox, 'Принял, иду', 30)
      await fBox.press('Enter')
      await pp.getByRole('log').getByText('Принял, иду').waitFor()
      // «Печатает…» и «прочитано».
      await fp.waitForTimeout(2600)
      await hr.type(fBox, 'уже набираю...', 60)
      await pp.locator('.chat__typing').filter({ hasText: 'печатает' }).waitFor()
      await hl.pause(1500)
      await fBox.fill('')
      await pp
        .locator('.chat__item--mine .chat__read')
        .first()
        .waitFor({ timeout: 10_000 })
        .catch(() => {})
      // Секретное сообщение.
      const secret = 'Steam-пароль: Zebra-4417'
      await hl.type(oBox, secret, 22)
      await hl.click(pp.getByRole('button', { name: 'Отправить секретное сообщение' }), {
        quick: true,
      })
      const plaque = fp.getByRole('button', { name: 'Секретное сообщение, нажми, чтобы показать' })
      await plaque.waitFor()
      await hr.pause(1200)
      await hr.click(plaque, { quick: true })
      await fp.getByRole('log').getByText(secret).waitFor()
      await hr.pause(1800)
    },
    async (state) => {
      if (state.bookingId) await state.admin?.cancelBooking(state.bookingId)
      await state.admin?.close()
    },
  )

// 06. Жалоба владельцу (E2E): слева игрок, справа владелец; в конце админ не видит раздел.
clips['06-complaint'] = () =>
  dualClip(
    '06-complaint',
    ['Игрок: жалоба шифруется на устройстве', 'Владелец: «Жалобы», расшифровка'],
    async (state) => {
      const pc = await dualContext(state, await registerPlayer('Анна', 'complaint'))
      const oc = await dualContext(state)
      const pp = await pc.newPage()
      const op = await oc.newPage()
      // Страницу игрока открываем только после ротации ключа (dualClip), иначе форма увидит «ключ изменился».
      await loginAdmin(op, 'owner@shift.local')
      // На чистом контексте кода восстановления нет: заранее (без записи) создаём новый ключ владельца.
      await op.goto('/admin/complaints', { waitUntil: 'domcontentloaded' })
      await waitInteractive(op)
      const create = op.getByRole('button', { name: 'Создать ключ' })
      const lost = op.getByRole('button', { name: 'Не помню код — создать новый ключ' })
      const ready = op.getByTestId('fingerprint')
      await create.or(lost).or(ready).waitFor()
      if (!(await ready.isVisible())) {
        if (await lost.isVisible()) {
          await op.getByText('Понимаю, что старые жалобы станут недоступны').click()
          await lost.click()
        } else {
          await create.click()
        }
        await op.getByTestId('recovery-code').waitFor()
        await op.getByText('Я записал код восстановления').click()
        await op.getByRole('button', { name: 'Завершить настройку' }).click()
        await ready.waitFor()
      }
      return {
        left: { page: pp, start: '/account/feedback' },
        right: { page: op, start: '/admin/complaints' },
      }
    },
    async (pp, hl, op, hr, state) => {
      void state
      await op.getByTestId('fingerprint').waitFor({ timeout: 10_000 })
      const text = 'Администратор вечером был вежлив, но кондиционер в зале не работает.'
      await hr.moveTo(300, 300)
      await hl.pause(900)
      const fp = pp.getByTestId('owner-fingerprint')
      await fp.scrollIntoViewIfNeeded()
      await hl.moveTo(300, (await fp.boundingBox()).y + 10)
      await hl.pause(1500)
      await hl.click(pp.getByRole('button', { name: /Категория/ }), { quick: true })
      await hl.click(pp.getByRole('option', { name: 'Персонал' }), { quick: true })
      await hl.click(pp.getByRole('button', { name: '4', exact: true }), { quick: true })
      await hl.type(pp.getByLabel('Текст обращения'), text, 25)
      await hl.click(pp.getByText('Показать моё имя владельцу'), { quick: true })
      await hl.pause(400)
      await hl.click(pp.getByRole('button', { name: 'Отправить владельцу' }), { quick: true })
      await pp.getByText('Обращение зашифровано на вашем устройстве').waitFor()
      await hl.pause(1200)
      await op.reload({ waitUntil: 'domcontentloaded' })
      await waitInteractive(op)
      const open = op.getByRole('button', { name: /Открыть/ }).first()
      await hr.click(open, { quick: true })
      await op.getByTestId('complaint-text').getByText(text.slice(0, 20)).waitFor()
      await hr.pause(2500)
      await op.evaluate(() => {
        const d = document.createElement('div')
        d.textContent = 'Администратор раздел «Жалобы» не видит: только владелец'
        d.style.cssText =
          'position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:14px 18px;background:#111;color:#fff;font:600 18px system-ui;text-align:center'
        document.body.append(d)
      })
      await hr.pause(3000)
    },
  )

// ---------- запуск ----------

const wanted = process.argv.slice(2)
const names = Object.keys(clips).filter(
  (n) =>
    wanted.length === 0 ||
    wanted.some((w) => n === w || n.startsWith(`${w}-`) || n.endsWith(`-${w}`) || n.includes(w)),
)
if (names.length === 0) {
  console.error(`Нет клипа ${wanted.join(', ')}. Доступны: ${Object.keys(clips).join(', ')}`)
  process.exit(1)
}
const results = []
const failed = []
for (const n of names) {
  console.log(`== ${n}`)
  try {
    results.push(await clips[n]())
  } catch (e) {
    failed.push(n)
    console.error(`Клип ${n} не записан: ${e.message}`)
  }
}
await browser.close()
console.log(`\nГотово:\n${results.join('\n')}`)
if (failed.length) {
  console.log(`Не записаны: ${failed.join(', ')}`)
  process.exitCode = 1
}
