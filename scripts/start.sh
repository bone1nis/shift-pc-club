#!/usr/bin/env bash
# Весь проект одной командой, из одного Docker: сайт, админка, документация, API, брокер, базы.
# Требуется только Docker (Node и PHP на машине не нужны).
#   ./scripts/start.sh               — запуск
#   ./scripts/start.sh --monitoring  — вместе с Grafana, Prometheus и Loki
#   SHIFT_MODE=prod ./scripts/start.sh — строгие правила (лимиты входа и заселение за 15 минут); по умолчанию dev, см. .env.example
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo 'Установите Docker и Docker Compose v2.'; exit 1; }
docker info >/dev/null 2>&1 || { echo 'Docker не запущен: откройте Docker Desktop и повторите.'; exit 1; }

# Секреты и ключи JWT создаются один раз; существующие значения сохраняются. Node берётся из контейнера.
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/app -w /app node:22-alpine node scripts/bootstrap.mjs

export SHIFT_PROXY_CONF=nginx.prod.conf
./scripts/backend-init.sh
docker compose --profile prod up -d --build web static proxy
if [[ "${1:-}" == "--monitoring" ]]; then
  docker compose --profile monitoring up -d
fi

port="$(grep -E '^SHIFT_HTTP_PORT=' .env | cut -d= -f2-)"
grafana="$(grep -E '^GRAFANA_PASSWORD=' .env | cut -d= -f2-)"
cat <<INFO

Готово. Откройте:
  Сайт            http://localhost:${port:-8088}/
  Админка         http://localhost:${port:-8088}/admin/
  Руководства     http://localhost:${port:-8088}/docs/
  Storybook       http://localhost:${port:-8088}/storybook/
  Почта (Mailpit) http://localhost:8028/
  RabbitMQ        http://localhost:15678/   (логин и пароль — RABBITMQ_* в .env)

Тестовые аккаунты (создаются только локально):
  Администратор   admin@shift.local   пароль ShiftDemo2026!
  Игрок           player@shift.local  пароль ShiftDemo2026!

Grafana (с --monitoring): http://localhost:3038/  логин admin  пароль ${grafana}
Остановить: docker compose --profile prod --profile monitoring down   (данные сохраняются)
INFO
