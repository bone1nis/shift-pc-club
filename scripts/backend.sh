#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:-test}"
service_scope="${2:-}"
if [[ -n "$service_scope" && "$service_scope" != identity && "$service_scope" != club && "$service_scope" != booking ]]; then
  echo 'Service must be identity, club or booking' >&2
  exit 1
fi
if [[ "$mode" == test ]]; then
  if [[ -f .runtime/test-db.env ]]; then
    while IFS='=' read -r test_password_key test_password_value; do
      case "$test_password_key" in
        IDENTITY_TEST_DB_PASSWORD|CLUB_TEST_DB_PASSWORD|BOOKING_TEST_DB_PASSWORD)
          if [[ -z "${!test_password_key:-}" ]]; then
            printf -v "$test_password_key" '%s' "$test_password_value"
          fi
          ;;
      esac
    done < .runtime/test-db.env
  fi
  : "${IDENTITY_TEST_DB_PASSWORD:?Configure a dedicated identity_test role first}"
  : "${CLUB_TEST_DB_PASSWORD:?Configure a dedicated club_test role first}"
  : "${BOOKING_TEST_DB_PASSWORD:?Configure a dedicated booking_test role first}"
fi
for service in identity club booking; do
  if [[ -n "$service_scope" && "$service_scope" != "$service" ]]; then continue; fi
  case "$mode" in
    lint)
      docker compose exec -T "$service" composer validate --strict
      docker compose exec -T "$service" vendor/bin/pint --test
      ;;
    format) docker compose exec -T "$service" vendor/bin/pint ;;
    analyse) docker compose exec -T "$service" vendor/bin/phpstan analyse --no-progress --memory-limit=1G ;;
    test)
      case "$service" in
        identity) test_password_variable=IDENTITY_TEST_DB_PASSWORD ;;
        club) test_password_variable=CLUB_TEST_DB_PASSWORD ;;
        booking) test_password_variable=BOOKING_TEST_DB_PASSWORD ;;
      esac
      DB_PASSWORD="${!test_password_variable}" docker compose exec -T \
        -e DB_PASSWORD -e APP_ENV=testing -e DB_CONNECTION=pgsql -e DB_URL= \
        -e DB_DATABASE="shift_${service}_test" -e DB_USERNAME="${service}_test" \
        "$service" vendor/bin/phpunit "${@:3}"
      ;;
    *) echo 'Использование: scripts/backend.sh lint|format|analyse|test'; exit 2 ;;
  esac
done
