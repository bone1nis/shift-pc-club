#!/usr/bin/env node
// Собирает набор иконок UI-кита из Lucide (пакет @iconify-json/lucide) в `src/icons/data.ts`.
// Иконки входят в итоговую сборку только из этого списка: чтобы добавить новую, допишите её имя и запустите
// `pnpm --filter @shift/ui icons`.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const NAMES = [
  'arrow-left',
  'arrow-right',
  'arrow-up-right',
  'banknote',
  'calendar',
  'calendar-days',
  'check',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'circle-check',
  'clock',
  'cpu',
  'external-link',
  'house',
  'info',
  'layout-dashboard',
  'list',
  'log-out',
  'mail',
  'map-pin',
  'menu',
  'minus',
  'monitor',
  'phone',
  'plus',
  'refresh-cw',
  'search',
  'settings',
  'trending-up',
  'triangle-alert',
  'user',
  'users',
  'wrench',
  'x',
]

const require = createRequire(import.meta.url)
const set = JSON.parse(readFileSync(require.resolve('@iconify-json/lucide/icons.json'), 'utf8'))
const lines = NAMES.map((name) => {
  const icon = set.icons[name]
  if (!icon) throw new Error(`В Lucide нет иконки «${name}»`)
  // Общие атрибуты линии (цвет, толщина, скругления) задаёт компонент UiIcon, поэтому из путей они убираются.
  const body = icon.body.replace(
    / (fill|stroke|stroke-linecap|stroke-linejoin|stroke-width)="[^"]*"/g,
    '',
  )
  return `  ${JSON.stringify(name)}: ${JSON.stringify(body)},`
})
const out = `// Файл создан скриптом scripts/generate-icons.mjs из набора Lucide (лицензия ISC). Не правьте вручную.
export const icons = {
${lines.join('\n')}
} as const

export type IconName = keyof typeof icons
`
writeFileSync(fileURLToPath(new URL('../src/icons/data.ts', import.meta.url)), out)
console.log(`Иконок: ${NAMES.length}`)
