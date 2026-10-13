import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'ru-RU',
  title: 'SHIFT · документация',
  description: 'Инструкции игрокам и администраторам, устройство и разработка SHIFT PC Club.',
  base: '/docs/',
  cleanUrls: true,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/docs/favicon.svg' }]],
  themeConfig: {
    nav: [
      { text: 'Статус', link: '/status' },
      { text: 'Игрокам', link: '/user/' },
      { text: 'Администраторам', link: '/admin/' },
      { text: 'Разработчикам', link: '/developer/' },
      { text: 'Модель клуба', link: '/domain/' },
      { text: 'Решения', link: '/adr/' },
    ],
    sidebar: {
      '/user/': [{ text: 'Игрокам', items: [{ text: 'Бронирование и кабинет', link: '/user/' }] }],
      '/admin/': [
        { text: 'Администраторам', items: [{ text: 'Работа со сменой', link: '/admin/' }] },
      ],
      '/developer/': [
        {
          text: 'Разработка',
          items: [
            { text: 'Запуск проекта', link: '/developer/' },
            { text: 'Архитектура и безопасность', link: '/developer/architecture' },
            { text: 'Сервисы backend', link: '/developer/services/' },
            { text: 'Identity', link: '/developer/services/identity' },
            { text: 'Club', link: '/developer/services/club' },
            { text: 'Booking', link: '/developer/services/booking' },
            { text: 'Сервисы и фронтенд', link: '/developer/services/frontend-flow' },
            { text: 'Фронтенд и UI-кит', link: '/developer/frontend' },
            { text: 'Тесты и проверки', link: '/developer/testing' },
            { text: 'Библиотеки фронтенда', link: '/developer/libraries' },
            { text: 'API и события', link: '/developer/api' },
            { text: 'Outbox и inbox', link: '/developer/events' },
            { text: 'Мониторинг', link: '/developer/monitoring' },
          ],
        },
      ],
      '/domain/': [
        { text: 'Предметная область', items: [{ text: 'Сущности и состояния', link: '/domain/' }] },
      ],
      '/adr/': [
        {
          text: 'Архитектурные решения',
          items: [
            { text: 'Обзор', link: '/adr/' },
            { text: 'Токены в HttpOnly cookie и CSRF', link: '/adr/0001-jwt-http-only-cookies' },
            {
              text: 'События через RabbitMQ с outbox и inbox',
              link: '/adr/0002-rabbitmq-outbox-inbox',
            },
            {
              text: 'Отдельная база PostgreSQL для каждого сервиса',
              link: '/adr/0003-database-per-service',
            },
            {
              text: 'Бронь и сессии резервируют места одной транзакцией',
              link: '/adr/0004-booking-reservation-in-one-transaction',
            },
            {
              text: 'Опрос вместо WebSocket на первом этапе',
              link: '/adr/0005-polling-before-websockets',
            },
            {
              text: 'Перевод места на обслуживание подтверждает Booking',
              link: '/adr/0006-maintenance-coordination',
            },
          ],
        },
      ],
      '/api/': [
        {
          text: 'OpenAPI / Swagger UI',
          items: [
            { text: 'Identity', link: '/api/identity/' },
            { text: 'Club', link: '/api/club/' },
            { text: 'Booking', link: '/api/booking/' },
          ],
        },
      ],
    },
    socialLinks: [],
    footer: { message: 'Локальная документация демонстрационного проекта SHIFT.' },
  },
})
