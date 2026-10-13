# Архитектурные решения

Ключевые решения с причинами и последствиями. Новое решение оформляйте отдельным файлом `NNNN-название.md` и добавляйте в список.

- [Токены в HttpOnly cookie и CSRF](/adr/0001-jwt-http-only-cookies)
- [События через RabbitMQ с outbox и inbox](/adr/0002-rabbitmq-outbox-inbox)
- [Отдельная база PostgreSQL для каждого сервиса](/adr/0003-database-per-service)
- [Бронь и сессии резервируют места одной транзакцией](/adr/0004-booking-reservation-in-one-transaction)
- [Опрос вместо WebSocket на первом этапе](/adr/0005-polling-before-websockets)
- [Перевод места на обслуживание подтверждает Booking](/adr/0006-maintenance-coordination)
