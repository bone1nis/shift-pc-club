import type { Page } from '@playwright/test'

/**
 * Ждёт, пока страница станет интерактивной: сайт (Nuxt SSR) — по окончании гидратации,
 * админка (Vue SPA) — по появлению смонтированного приложения. Работает и в dev, и в продакшен-сборке.
 */
export async function waitForInteractive(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const nuxt = (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp
    if (nuxt) return nuxt().isHydrating === false
    return Boolean(document.querySelector('#app')?.children.length)
  })
}
