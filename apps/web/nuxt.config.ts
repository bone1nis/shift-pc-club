import { fileURLToPath } from 'node:url'
export default defineNuxtConfig({
  compatibilityDate: '2026-10-12',
  ssr: true,
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@vite-pwa/nuxt'],
  css: ['@shift/ui/tokens.css'],
  alias: { '@fsd': fileURLToPath(new URL('./src', import.meta.url)) },
  components: false,
  imports: { autoImport: false },
  typescript: { strict: true, typeCheck: false },
  runtimeConfig: {
    apiInternalOrigin: process.env.API_INTERNAL_ORIGIN || 'http://localhost:8088',
    public: { apiBase: '' },
  },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'SHIFT — компьютерный клуб нового уровня',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        // Шрифты нужны для первого экрана: просим браузер загрузить их сразу, чтобы текст не «перескакивал».
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/Manrope-Variable.woff2',
          crossorigin: '',
        },
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/BarlowCondensed-ExtraBold.woff2',
          crossorigin: '',
        },
      ],
      // Без JavaScript блоки с анимацией появления всё равно видны.
      noscript: [{ innerHTML: '<style>.reveal{opacity:1!important}</style>' }],
      meta: [
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'SHIFT Gaming Club' },
        { property: 'og:title', content: 'SHIFT — компьютерный клуб нового уровня' },
        {
          property: 'og:description',
          content:
            'Игровые залы Арена и VIP, мощные компьютеры, бар и бронирование онлайн. Открыты 24/7.',
        },
        { property: 'og:image', content: '/og-image.png' },
        { property: 'og:locale', content: 'ru_RU' },
        { name: 'twitter:card', content: 'summary_large_image' },
        {
          name: 'description',
          content:
            'Твой следующий уровень начинается здесь. Выбирай зал, собирай команду и бронируй игровые места в SHIFT.',
        },
      ],
    },
  },
  // PWA: сайт можно установить на телефон. Service worker кэширует только статику (скрипты, стили, шрифты, иконки)
  // и открытые страницы; запросы к /api, админка, документация и Storybook всегда идут напрямую в сеть.
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'SHIFT — компьютерный клуб',
      short_name: 'SHIFT',
      description: 'Бронирование игровых мест в клубе SHIFT.',
      lang: 'ru',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#111212',
      theme_color: '#111212',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/icons/icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,woff2,svg,webp}', 'icons/*.png'],
      globIgnores: ['**/images/gallery/**', '**/screens/**'],
      navigateFallback: null,
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          urlPattern: ({ request, url }: { request: Request; url: URL }) =>
            request.mode === 'navigate' &&
            !/^\/(api|admin|docs|storybook)(\/|$)/.test(url.pathname),
          handler: 'NetworkFirst',
          options: { cacheName: 'shift-pages', networkTimeoutSeconds: 4 },
        },
      ],
    },
    client: { installPrompt: false },
    devOptions: { enabled: false },
  },
  nitro: {
    // Шрифты, иконки и favicon общие для web, admin и Storybook: лежат в packages/ui/public.
    publicAssets: [{ dir: fileURLToPath(new URL('../../packages/ui/public', import.meta.url)) }],
    devProxy: {
      '/api': {
        target: process.env.API_INTERNAL_ORIGIN || 'http://localhost:8088',
        changeOrigin: false,
      },
    },
  },
})
