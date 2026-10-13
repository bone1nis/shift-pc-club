import type { Directive } from 'vue'

/**
 * Появление блока при прокрутке: `v-reveal` (или `v-reveal="2"` — номер в ряду, даёт задержку для «лесенки»).
 * Модификаторы: `.left`, `.right`, `.zoom` задают направление появления.
 * На сервере блок получает класс `reveal` (скрыт), в браузере класс `is-in` добавляется, когда блок входит в экран.
 * Сами стили лежат в `app/app.vue`; без JavaScript блоки показываются через <noscript> (см. nuxt.config.ts).
 */
const STEP_MS = 90
let observer: IntersectionObserver | undefined

function watcher(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        observer?.unobserve(entry.target)
      }
    },
    { threshold: 0, rootMargin: '0px 0px -10% 0px' },
  )
  return observer
}

const delay = (value: number | undefined) => `${Math.min(value ?? 0, 6) * STEP_MS}ms`
const variant = (modifiers: Partial<Record<string, boolean>>) =>
  ['left', 'right', 'zoom'].find((name) => modifiers[name])

export const vReveal: Directive<HTMLElement, number | undefined> = {
  getSSRProps(binding) {
    const kind = variant(binding.modifiers)
    return {
      class: kind ? `reveal reveal--${kind}` : 'reveal',
      style: { '--reveal-delay': delay(binding.value) },
    }
  },
  created(el, binding) {
    const kind = variant(binding.modifiers)
    el.classList.add('reveal')
    if (kind) el.classList.add(`reveal--${kind}`)
    el.style.setProperty('--reveal-delay', delay(binding.value))
  },
  mounted(el) {
    if (typeof IntersectionObserver === 'undefined') el.classList.add('is-in')
    else watcher().observe(el)
  },
  unmounted(el) {
    observer?.unobserve(el)
  },
}
