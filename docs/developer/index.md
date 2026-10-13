# Разработчику: запуск и проверки

Корень — pnpm workspace. `apps/web` — Nuxt SSR сайт и кабинет, `apps/admin` — Vue/Vite рабочее место. Laravel 13 сервисы имеют отдельные базы: Identity, Club и Booking. Общие компоненты и API-типы живут в `packages/ui` и `packages/contracts`.

Описание каждого сервиса — [Backend: Identity, Club, Booking](/developer/services/); про фронтенд — [Фронтенд и UI-кит](/developer/frontend) и [библиотеки](/developer/libraries).

## Быстрый старт

Нужны Node 22, pnpm 10.12.4 и Docker Compose v2. PHP 8.5 и Composer доступны в контейнерном образе.

```sh
./scripts/setup.sh
./scripts/dev.sh
```

Полное описание локальных адресов, демо-аккаунтов, остановки и проблем находится в корневом `README.md`. Compose создаёт локальную конфигурацию в игнорируемых файлах. Не коммитьте `.env`, `.runtime/`, ключи, логи, базы и пользовательские данные.

## Проверки

Полное описание всех уровней проверок и что запускать после каких изменений — [Тесты и проверки](/developer/testing).

Корневые скрипты: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm build`. Backend-команды собраны в `scripts/backend.sh` и `scripts/check.sh`; откройте скрипт перед запуском, чтобы понять охват. Не все тесты и production checks сейчас завершены — смотрите [текущий статус](/status).

Изменение API требует обновить OpenAPI и типы в `packages/contracts`; изменение пользовательского поведения — соответствующее руководство. Сначала определите сервис-владелец. Межсервисные операции идут через внутренний API или событие, прямой доступ к чужим базам запрещён.

## Аудит зависимостей

CI выполняет `pnpm audit --prod` и `composer audit` для каждого сервиса. Исключения для pnpm заданы в `package.json` (`pnpm.auditConfig.ignoreGhsas`): шесть уязвимостей в транзитивных зависимостях инструментов сборки Nuxt (`@nuxt/devtools` → `simple-git`, `nitropack` → `node-forge`, `braces`). Это инструменты разработки и сборки, они не входят в `.output` и не выполняются в продакшене. Пересмотреть исключения до 13 ноября 2026 или раньше, когда выйдут обновлённые Nuxt/Nitro.

## Продакшен-запуск фронтенда

Профиль Compose `prod` собирает два образа из `infra/node/Dockerfile`: `web` (Nuxt, `node server/index.mjs`, healthcheck) и `static` (nginx с админкой и документацией, SPA-фолбэк для `/admin/`, долгий кэш для `/admin/assets/`). Единый origin и маршрутизацию API по-прежнему обеспечивает прокси: для продакшена он берёт `infra/proxy/nginx.prod.conf` (имена сервисов вместо `host.docker.internal`, динамический DNS, чтобы старт не зависел от порядка запуска, `/healthz`). Команда запуска — в README.

## Запуск одной командой

`./scripts/start.sh` поднимает весь проект из Docker (нужен только Docker): создаёт `.env` и ключи JWT (Node берётся из контейнера), ставит зависимости, делает миграции и сидеры, запускает воркеры и продакшен-сборку сайта, админки и документации. С флагом `--monitoring` добавляет Grafana, Prometheus и Loki. Для разработки с горячей перезагрузкой остаются `./scripts/setup.sh` и `./scripts/dev.sh`.
