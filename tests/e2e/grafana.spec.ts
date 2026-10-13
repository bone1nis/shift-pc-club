import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// Дашборды Grafana не должны содержать панелей с ошибкой запроса. Нужен профиль monitoring
// (`./scripts/start.sh --monitoring`); без Grafana тест пропускается.
const base = process.env.GRAFANA_URL ?? 'http://localhost:3038'

function password(): string | undefined {
  if (process.env.GRAFANA_PASSWORD) return process.env.GRAFANA_PASSWORD
  try {
    return /^GRAFANA_PASSWORD=(.+)$/m.exec(readFileSync('.env', 'utf8'))?.[1]
  } catch {
    return undefined
  }
}

test('provisioned Grafana dashboards run their queries without errors', async ({
  browser,
  isMobile,
}) => {
  test.skip(isMobile, 'Только десктоп')
  const secret = password()
  test.skip(!secret, 'Нет GRAFANA_PASSWORD')
  const context = await browser.newContext({
    viewport: { width: 1500, height: 2000 },
    extraHTTPHeaders: {
      Authorization: 'Basic ' + Buffer.from(`admin:${secret}`).toString('base64'),
    },
  })
  const page = await context.newPage()
  const reachable = await page.request
    .get(`${base}/api/health`)
    .then((r) => r.ok())
    .catch(() => false)
  test.skip(!reachable, 'Grafana не запущена (нужен профиль monitoring)')

  const found = (await (await page.request.get(`${base}/api/search?query=SHIFT`)).json()) as {
    type: string
    url: string
    title: string
  }[]
  const dashboards = found.filter((item) => item.type === 'dash-db')
  expect(dashboards.length).toBeGreaterThanOrEqual(2)
  for (const dashboard of dashboards) {
    const failures: string[] = []
    page.removeAllListeners('console')
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('runRequest.catchError'))
        failures.push(message.text().split('\n')[0]!)
    })
    await page.goto(`${base}${dashboard.url}?from=now-7d&to=now`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    expect(failures, `${dashboard.title}: query errors`).toEqual([])
  }
  await context.close()
})
