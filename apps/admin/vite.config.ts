import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
// Публичный ключ Reverb берётся из корневого .env (или из окружения сборки).
const rootEnv = loadEnv('', fileURLToPath(new URL('../..', import.meta.url)), 'REVERB_')
export default defineConfig({
  define: {
    __REVERB_APP_KEY__: JSON.stringify(process.env.REVERB_APP_KEY ?? rootEnv.REVERB_APP_KEY ?? ''),
  },
  base: '/admin/',
  // Общая статика (шрифты, иконки, favicon) лежит в packages/ui/public.
  publicDir: fileURLToPath(new URL('../../packages/ui/public', import.meta.url)),
  plugins: [
    vue(),
    // PWA: панель можно установить на телефон администратора. Кэшируется только оболочка (скрипты, стили);
    // запросы к /api никогда не кэшируются — данные клуба всегда свежие.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SHIFT — панель администратора',
        short_name: 'SHIFT Admin',
        lang: 'ru',
        start_url: '/admin/',
        scope: '/admin/',
        display: 'standalone',
        background_color: '#111212',
        theme_color: '#151717',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        navigateFallback: '/admin/index.html',
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: { alias: { '@fsd': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    proxy: {
      '/app': {
        target: process.env.API_INTERNAL_ORIGIN || 'http://localhost:8088',
        changeOrigin: false,
        ws: true,
      },
      '/api': {
        target: process.env.API_INTERNAL_ORIGIN || 'http://localhost:8088',
        changeOrigin: false,
      },
    },
  },
})
