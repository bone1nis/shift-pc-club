# HTTP API и события

API доступно через единый origin с префиксами `/api/auth/`, `/api/club/` и `/api/booking/`. Основные публичные/пользовательские маршруты перечислены ниже; внутренние операции не являются публичным API.

## Identity

- `GET /api/auth/csrf` — получить CSRF bootstrap cookie/token.
- `POST /api/auth/register`, `login`, `refresh`, `logout`, `forgot-password`, `reset-password` — учётная запись и вход.
- `GET /api/auth/me`, `sessions`; `DELETE /api/auth/sessions/{id}`; `POST /api/auth/logout-all` — текущий пользователь и его входы.
- `POST /api/auth/internal/introspect` — внутренний вызов сервисов с внутренней авторизацией.

## Club

- `GET /api/club/catalog` — зоны, места и тарифы.
- `/api/club/admin/*` — изменение зон, компьютеров и тарифов, а также аудит. Нужны права администратора, CSRF и действующая авторизация.
- `/api/club/internal/catalog` — внутренний snapshot каталога.

## Booking

- `GET /api/booking/availability` — доступность мест для временного диапазона.
- Авторизованные маршруты `/api/booking/bookings`, `/api/booking/sessions`, `/api/booking/notifications` поддерживают личный кабинет и операции бронирования.
- `/api/booking/admin/*` предоставляет администратору список броней/сессий, заселение, гостевые сессии, завершение, продление, пересадку, аудит, отчёты (`reports`, параметр `zone_id`), ежедневные сводки (`daily-reports`), CSV-выгрузки (`report-exports`) и уведомления с повтором отправки (`notifications`, `notifications/{id}/retry`).
- `POST /api/booking/bookings` принимает ключ `Idempotency-Key`. При сетевом повторе используйте тот же ключ для того же запроса.
- `POST /api/booking/events` — публичный приём анонимных событий сайта (`page_view`, `booking_started`): разрешены только перечисленные типы и пути `/`, `/booking`, `/auth`, `/account`; идентификатор посетителя — случайный UUID вкладки; боты, чужой Origin и повторы в окне 30 минут (`ANALYTICS_DEDUPE_MINUTES`) отбрасываются, ответ 204 или 202. Успешные брони считаются по серверным данным, а не по событиям.
- `/api/booking/internal/*` предназначен для межсервисного доступа.

Scramble установлен в сервисах. Спецификации публикуются по `/api/auth/openapi.json`, `/api/club/openapi.json` и `/api/booking/openapi.json`; страницы [Swagger UI Identity](/api/identity/), [Club](/api/club/) и [Booking](/api/booking/) загружают их через локальный origin. Пока backend endpoint не включён в запущенном сервисе, viewer сообщит, что схему загрузить не удалось. Не используйте внутренние endpoints из браузера и не подставляйте cookie как Bearer-токен.

## Ошибки и защита

Ожидаемые статусы включают `401` для отсутствующей/просроченной авторизации, `403` для недостаточных прав/CSRF, `409` для конфликтов доступности или повторного состояния, `422` для ошибок валидации и `429` для ограничения частоты. Проверяйте форму ответа в OpenAPI. Изменяющие запросы используют CSRF bootstrap и серверные cookies; API-клиент приложения централизует эти детали.

## События

Подробно о доставке, дублях и правилах для получателей — в разделе [Outbox и inbox](/developer/events).

Сервис-владелец записывает событие в `outbox` в той же транзакции. Publisher публикует в RabbitMQ после commit, ожидая publisher confirm. При потере подтверждения возможна повторная отправка, поэтому `event_id` дедуплицируется consumer-ом через inbox. Схемы событий версионируются и должны сохранять совместимость с существующими потребителями. Конкретные routing keys, события и состояние контрактов следует сверять с реализацией брокера; план не является контрактом.
