# Realtime

Сервис чата брони и WebSocket-сигналов. Жалобы и отзывы владельцу живут не здесь, а в [Club](/developer/services/club).

## Из чего состоит

Четыре контейнера из одного кода (`services/realtime`):

| Контейнер            | Команда                | Назначение                                              |
| -------------------- | ---------------------- | ------------------------------------------------------- |
| `realtime`           | HTTP API (:8000)       | чат, ключи устройств, авторизация каналов               |
| `reverb`             | `reverb:start` (:8080) | WebSocket-сервер (Laravel Reverb)                       |
| `realtime-worker`    | `events:consume`       | слушает RabbitMQ и рассылает сигналы                    |
| `realtime-scheduler` | `schedule:work`        | удаляет вложения (30 дней) и секреты (24 часа) по сроку |

Наружу порты не публикуются: прокси отдаёт API по `/api/realtime/`, WebSocket по `/app` и `/apps`. Путь `/api/realtime/internal/` закрыт. База — `shift_realtime`.

## Что делает

- **Сигналы.** После события брони или сессии рассылает в каналы короткое `{type, id}`: `account.changed` в `private-user.{id}`, `hall.changed` в `private-hall`, `complaint.created` в `private-owner`. Данные по WebSocket не идут: клиент после сигнала запрашивает их по REST ([ADR 0007](/adr/0007-reverb-and-e2ee)).
- **Чат брони.** Диалог на бронь, история, непрочитанное, вложения, модерация (удалить сообщение, заглушить участника), лимит 20 сообщений в минуту.
- **Участники.** Состав ведёт сам сервис (`booking_participants`): владелец брони появляется по `booking.confirmed`, остальные заходят по ссылке-приглашению на 72 часа (токен хранится как sha256). Чат закрывается по отмене, неявке и завершению брони.
- **Секретные сообщения.** Сообщение `kind=secret` приходит уже зашифрованным: сервер хранит конверты для активных устройств получателей и не может его прочитать. Если набор конвертов не совпадает с активными устройствами — `422 envelopes_mismatch`. Устройства регистрируются через `POST /devices`.

## API (`/api/realtime/*`)

Все пути, кроме `health`, требуют входа и CSRF.

| Группа      | Пути                                                                                  |
| ----------- | ------------------------------------------------------------------------------------- |
| каналы      | `POST broadcasting/auth`                                                              |
| устройства  | `POST devices`, `DELETE devices/{id}`, `GET conversations/{bookingId}/keys`           |
| диалог      | `GET conversations/{bookingId}`, `messages` (список, отправка), `read`, `attachments` |
| модерация   | `DELETE conversations/{bookingId}/messages/{id}`, `POST …/participants/{userId}/mute` |
| приглашения | `POST bookings/{bookingId}/invitations`, `POST invitations/{token}/accept`            |
| служебное   | `GET health`, `/metrics`                                                              |

## Права на каналы

Правила в `routes/channels.php`; роль берётся из Identity (`introspect`), а не из JWT.

| Канал                        | Кто может подписаться                                 |
| ---------------------------- | ----------------------------------------------------- |
| `private-user.{id}`          | только сам пользователь                               |
| `private-hall`               | `admin` и `owner`                                     |
| `private-owner`              | только `owner`                                        |
| `private-booking.{id}.chat`  | участник брони; закрытие доступ на чтение не отзывает |
| `presence-booking.{id}.chat` | то же, отдаёт только `{id, name}`                     |

## Обработка событий

Тот же подход, что в Booking: очередь `shift.realtime.events`, таблица `inbox`, повторы через очереди задержки 5, 30 и 120 секунд, до 4 попыток, своя dead-letter очередь `realtime.dead` ([подробно](/developer/events)). Проекция и рассылка идут в одной транзакции, сбой рассылки откатывает запись и отправляет сообщение на повтор.

Письмо владельцу о новой жалобе тоже отправляет воркер: после `complaint.created` он берёт адреса активных владельцев у Identity. Письмо содержит только номер и ссылку, сбой отправки логируется и не повторяется.

## Настройки

В `.env`: `REALTIME_DB_PASSWORD`, `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET` (создаёт `scripts/bootstrap.mjs`, существующие не перезаписывает). Reverb сверяет только имя хоста в `Origin`, поэтому по умолчанию разрешены `localhost,127.0.0.1`; для другого хоста задайте `REVERB_ALLOWED_ORIGINS`.

## Проверка

```sh
./scripts/backend.sh test realtime
./scripts/backend.sh analyse realtime
```

Тесты используют базу `shift_realtime_test` и роль `realtime_test` (guard в `TestCase`).
