# Сервисы backend

Backend состоит из трёх независимых Laravel 13 приложений (PHP 8.5). У каждого своя база PostgreSQL, свой код и свои тесты; общих таблиц и прямых обращений к чужой базе нет ([ADR 0003](/adr/0003-database-per-service)).

| Сервис       | Отвечает за                                | База             | Подробнее                                |
| ------------ | ------------------------------------------ | ---------------- | ---------------------------------------- |
| **Identity** | аккаунты, вход, сессии устройств, роли     | `shift_identity` | [Identity](/developer/services/identity) |
| **Club**     | зоны, компьютеры, тарифы, профиль клуба    | `shift_club`     | [Club](/developer/services/club)         |
| **Booking**  | брони, игровые сессии, отчёты, уведомления | `shift_booking`  | [Booking](/developer/services/booking)   |

## Как сервисы связаны

```text
браузер ──▶ nginx (:8088) ──┬─▶ /api/auth/*     Identity
                            ├─▶ /api/club/*     Club
                            └─▶ /api/booking/*  Booking

Club ──событие club.catalog.updated──▶ RabbitMQ ──▶ Booking (копия каталога)
Booking ──события booking.*, session.*──▶ RabbitMQ ──▶ внутренние обработчики
Booking ──внутренний HTTP──▶ Identity (проверка токена), Club (каталог)
```

- **Единый вход.** Браузер видит один адрес; прокси раскладывает запросы по префиксу пути. Токены лежат в HttpOnly-cookie ([ADR 0001](/adr/0001-jwt-http-only-cookies)), для изменяющих запросов нужен CSRF-токен.
- **Внутренние запросы** между сервисами идут по `/api/*/internal/*` с общим секретом `INTERNAL_TOKEN`; снаружи (через прокси) эти пути закрыты.
- **События** передаются через outbox и inbox ([подробно](/developer/events)).

## Общее устройство каждого сервиса

| Что                                           | Где                                          |
| --------------------------------------------- | -------------------------------------------- |
| маршруты                                      | `services/<имя>/routes/api.php`              |
| контроллеры                                   | `app/Http/Controllers`                       |
| посредники (авторизация, CSRF, роли, метрики) | `app/Http/Middleware`                        |
| логика                                        | `app/Services`                               |
| консольные команды и расписание               | `app/Console/Commands`, `routes/console.php` |
| настройки проекта                             | `config/shift.php`                           |
| сообщения на русском                          | `lang/ru`, `lang/ru.json`                    |
| тесты                                         | `tests/Feature`, `tests/Unit`                |

Метрики для Prometheus каждый сервис отдаёт на `/metrics`, журналы пишет в JSON на русском (только номера, без персональных данных).

## Режим работы

Переменная `SHIFT_MODE` (`dev` или `prod`) меняет лимиты запросов и окно заселения (см. README). PHPUnit всегда запускается в режиме `prod`.

## Запуск проверок

```sh
./scripts/backend.sh test            # все три сервиса
./scripts/backend.sh test booking    # один сервис
./scripts/backend.sh lint            # Pint
./scripts/backend.sh analyse         # PHPStan
```

Тесты выполняются в отдельных базах `shift_*_test` с ролями `*_test`; рабочие данные не затрагиваются.
