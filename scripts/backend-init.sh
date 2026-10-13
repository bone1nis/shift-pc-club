#!/usr/bin/env bash
# Поднимает серверную часть в Docker: образы, зависимости, ключи, базы, миграции, демо-данные, воркеры.
# Нужен только Docker; файл `.env` в корне и ключи JWT должны уже существовать (их создаёт scripts/bootstrap.mjs).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose config --quiet
docker compose build identity
for service in identity club booking; do
  if [[ ! -f "services/$service/.env" ]]; then
    cp "services/$service/.env.example" "services/$service/.env"
  fi
  docker compose run --rm --no-deps "$service" composer install --no-interaction --prefer-dist
  if ! grep -q '^APP_KEY=base64:' "services/$service/.env"; then
    docker compose run --rm --no-deps "$service" php artisan key:generate --force
  fi
done
docker compose up -d postgres redis rabbitmq mailpit
docker compose up -d identity club booking proxy
docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -v reporting_password="$REPORTING_DB_PASSWORD"' < infra/postgres/ensure-reporting-user.sql
for service in identity club booking; do
  docker compose exec -T "$service" php artisan migrate --force
  docker compose exec -T "$service" php artisan db:seed --force
done
docker compose up -d booking-worker booking-notification-worker booking-report-worker identity-scheduler club-scheduler booking-scheduler
docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U postgres -d shift_booking < infra/postgres/reporting-views.sql
