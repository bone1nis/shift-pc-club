# SHIFT PC Club

Система бронирования и управления компьютерным клубом. Монорепозиторий: два фронтенда, общие пакеты и четыре независимых Laravel-сервиса. Подробности — в [README.md](README.md) и [docs/](docs/).

## Структура

- `apps/web` — публичный сайт и кабинет игрока (Nuxt).
- `apps/admin` — рабочее место администратора и владельца (Vue + Vite).
- `packages/contracts` — Zod-схемы и типы API/событий (общий контракт фронта и бэка).
- `packages/ui` — UI-кит, общая статика, realtime-клиент.
- `packages/e2ee` — E2E-шифрование (ключи, конверты, отпечатки).
- `services/identity` — вход, сеансы, роли (`player`, `admin`, `owner`).
- `services/club` — каталог клуба, оборудование, тарифы, жалобы.
- `services/booking` — брони и сессии.
- `services/realtime` — чат брони, ключи устройств, WebSocket (Reverb), воркер событий.
- `infra/` — Dockerfile, nginx, Postgres; `scripts/` — запуск и проверки; `tests/` — unit (Vitest) и e2e (Playwright).

Сервисы общаются через REST и события RabbitMQ (outbox/inbox). У каждого своя база PostgreSQL.

## Окружение

- Node 22 (версия в `.nvmrc`), менеджер пакетов — pnpm. Системный Node может быть старее: `export PATH=$HOME/.nvm/versions/node/v22.22.0/bin:$PATH`.
- Backend запускается в Docker (PHP 8.5). Проверки — через `scripts/backend.sh`, а не напрямую `php`/`composer` с хоста.
- Секреты создаёт `scripts/bootstrap.mjs`; `.env` в репозиторий не попадает, существующие секреты не перезаписывать.

## Команды

Frontend (из корня):

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`
- `pnpm test:unit` / `pnpm test:coverage` — Vitest
- `pnpm test:e2e` — Playwright (нужен поднятый стек)
- `pnpm contracts:check` — контракты в актуальном состоянии
- `pnpm build`

Backend:

- `scripts/backend.sh lint [service]` — `composer validate` и Pint
- `scripts/backend.sh analyse [service]` — PHPStan
- `scripts/backend.sh test [service]` — PHPUnit в тестовых базах

Всё сразу: `scripts/check.sh [frontend|backend|all]`. Запуск стека: `scripts/start.sh`, `scripts/dev.sh`, `scripts/preview.sh`.

## Правила

- Не запускай `pnpm build` и `scripts/check.sh`, пока работают dev-серверы фронтенда: сборка Nuxt ломает `nuxt dev`. Перезапусти dev-серверы после сборки.
- Backend-тесты идут только в выделенных базах `shift_*_test` с ролями `*_test` (guard в `TestCase`, `APP_ENV=testing`, без `DB_URL`). Не запускай тесты и миграции на обычных (демо) базах.
- Не выполняй разрушительные операции с PostgreSQL вне тестовых баз и не очищай Docker volumes.
- Права проверяются на сервере. Роль берётся из Identity (`introspect`), а не из JWT. Разделы `/owner/*` доступны только `owner`.
- Данные по WebSocket не передаются: только короткие сигналы, дальше обычный REST. Опрос остаётся фолбэком.
- Содержимое секретных сообщений и жалоб шифруется на клиенте; сервер хранит только шифртекст.
- Меняя API или события, обновляй `packages/contracts` и тесты; публичные поля только добавляй (обратная совместимость).

## Код

- Следуй существующей архитектуре и стилю соседнего кода; без лишнего рефакторинга.
- Фронтенд организован по слоям FSD (`pages`, `features`, `widgets`, `shared`).
- Новое поведение покрывай тестами: Vitest для фронта, PHPUnit для backend.
- Перед пушем: `format:check`, `lint`, `typecheck`, `test:coverage`, backend `lint`, `analyse`, `test`.

## Язык

Документация (`README.md`, `docs/`) и сообщения коммитов — на русском. Идентификаторы, команды и код — как есть.
