#!/usr/bin/env bash
# Проверка устойчивости: воркер Booking убивается (SIGKILL), пока сообщение уже доставлено ему, но ещё не подтверждено (ack).
# Ожидание: RabbitMQ вернёт сообщение в очередь, перезапущенный воркер обработает его, в inbox будет ровно одна запись;
# повторная публикация того же event_id (дубль) новой записи не создаёт.
# Затрагивает только тестовое событие club.catalog.updated (пересинхронизация каталога) и одну строку inbox.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
API="http://127.0.0.1:15678/api"
AUTH="${RABBITMQ_USER:-shift}:${RABBITMQ_PASSWORD}"
EXCHANGE="shift.events"
QUEUE="shift.booking.events"
EVENT_ID="$(uuidgen | tr 'A-Z' 'a-z')"

publish() {
  curl -fsS -u "$AUTH" -H 'content-type: application/json' -X POST "$API/exchanges/%2F/$EXCHANGE/publish" -d "{
    \"properties\":{\"delivery_mode\":2,\"content_type\":\"application/json\",\"message_id\":\"$EVENT_ID\"},
    \"routing_key\":\"club.catalog.updated\",\"payload_encoding\":\"string\",
    \"payload\":\"{\\\"event_id\\\":\\\"$EVENT_ID\\\",\\\"type\\\":\\\"club.catalog.updated\\\",\\\"schema_version\\\":1,\\\"occurred_at\\\":\\\"$(date -u +%FT%TZ)\\\",\\\"correlation_id\\\":\\\"chaos-test\\\",\\\"payload\\\":{}}\"
  }" >/dev/null
}
queue_field() { curl -fsS -u "$AUTH" "$API/queues/%2F/$QUEUE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('$1',0))"; }
inbox_count() { docker compose exec -T postgres psql -U postgres -d shift_booking -tAc "select count(*) from inbox where event_id='$EVENT_ID'" | tr -d '[:space:]'; }
fail() { echo "ОШИБКА: $1"; docker compose up -d booking-worker >/dev/null 2>&1 || true; exit 1; }

echo "1. Замораживаем воркер и публикуем событие $EVENT_ID"
docker compose pause booking-worker >/dev/null
publish
for _ in $(seq 1 20); do [[ "$(queue_field messages_unacknowledged)" == "1" ]] && break; sleep 0.5; done
[[ "$(queue_field messages_unacknowledged)" == "1" ]] || fail "сообщение не дошло до воркера (unacked != 1)"
echo "   сообщение доставлено воркеру, но не подтверждено"

echo "2. Убиваем воркер (SIGKILL) посреди обработки"
docker compose kill -s SIGKILL booking-worker >/dev/null
for _ in $(seq 1 20); do [[ "$(queue_field messages_ready)" == "1" ]] && break; sleep 0.5; done
[[ "$(queue_field messages_ready)" == "1" ]] || fail "сообщение не вернулось в очередь"
[[ "$(inbox_count)" == "0" ]] || fail "событие обработано до перезапуска"
echo "   RabbitMQ вернул сообщение в очередь, в inbox пока 0"

echo "3. Запускаем воркер заново"
docker compose up -d booking-worker >/dev/null
for _ in $(seq 1 40); do [[ "$(inbox_count)" == "1" ]] && break; sleep 0.5; done
[[ "$(inbox_count)" == "1" ]] || fail "перезапущенный воркер не обработал событие"
echo "   событие обработано, записей в inbox: 1"

echo "4. Отправляем тот же event_id повторно (дубль доставки)"
publish
sleep 3
[[ "$(inbox_count)" == "1" ]] || fail "дубль создал вторую запись в inbox"
[[ "$(queue_field messages_ready)" == "0" && "$(queue_field messages_unacknowledged)" == "0" ]] || fail "очередь не пуста после обработки"
echo "ГОТОВО: потери нет, дубля нет, очередь пуста."
