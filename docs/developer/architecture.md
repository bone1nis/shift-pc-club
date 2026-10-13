# Архитектура и безопасность

```text
Browser → nginx proxy → Nuxt site / Vue admin
                   ├→ Identity API → shift_identity
                   ├→ Club API → shift_club
                   └→ Booking API → shift_booking
                         ↕ RabbitMQ events
             Redis cache/locks · PostgreSQL · Mailpit (local)
```

Nginx даёт единый origin: сайт `/`, админка `/admin/`, API `/api/auth/`, `/api/club/`, `/api/booking/`, документация `/docs/`, Storybook `/storybook/`. Внутренние маршруты API закрыты на proxy и требуют внутренний токен при межсервисном вызове.

Identity выдаёт краткоживущий JWT access token и отдельный вращаемый refresh cookie с HttpOnly; изменяющие запросы проходят CSRF-проверку. Приложения не сохраняют JWT в Pinia/localStorage. Проверка защищённого запроса сверяет актуальную auth-сессию в Identity; если Identity недоступен, запрос должен завершиться отказом. Администраторская роль всегда проверяется на сервере.

Каждый сервис изменяет только свою базу. Booking владеет бронями, резервированиями мест и игровыми сессиями; Club владеет каталогом; Identity владеет аккаунтами и входами. Событие записывается в outbox внутри той же транзакции, что и бизнес-изменение. RabbitMQ publisher confirms и повторная доставка не делают обработку exactly-once: consumer-ы обязаны быть идемпотентными.

Публичный каталог не требует входа. Закрытые API вызовы используют cookie credentials, CSRF заголовок и проверку роли. Не логируйте пароли, Authorization, cookies, токены и тела форм. Не добавляйте в метки метрик request/user/booking id. Используйте тестовые данные и локальный профиль.
