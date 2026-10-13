#!/usr/bin/env bash
# Продакшен-режим фронтенда: собирает web и admin и запускает их на портах 3000 и 5173,
# на которые смотрит прокси. Не запускайте одновременно с scripts/dev.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'if(Number(process.versions.node.split(".")[0]) < 22) process.exit(1)'
docker compose up -d postgres redis rabbitmq mailpit identity club booking proxy booking-worker identity-scheduler club-scheduler booking-scheduler
pnpm --filter @shift/web build
pnpm --filter @shift/admin build
printf '\nSHIFT (продакшен-сборка): http://localhost:8088 | Админка: /admin/\n'
export HOST=0.0.0.0 PORT=3000 API_INTERNAL_ORIGIN="${API_INTERNAL_ORIGIN:-http://localhost:8088}"
pnpm --filter @shift/web start &
trap 'kill $!' EXIT
pnpm --filter @shift/admin preview
