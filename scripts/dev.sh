#!/usr/bin/env bash
# Режим разработки: backend (API, брокер, базы, воркеры) в Docker, а фронтенд — на хосте с горячей перезагрузкой:
# сайт (Nuxt, :3000), админка (Vite, :5173), документация (:5175) и Storybook (:6006). Прокси на :8088 направляет на них.
# Нужны Node 22 и выполненный ./scripts/setup.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'if(Number(process.versions.node.split(".")[0]) < 22) process.exit(1)'
docker compose up -d postgres redis rabbitmq mailpit identity club booking proxy
export API_INTERNAL_ORIGIN="${API_INTERNAL_ORIGIN:-http://localhost:8088}"
mkdir -p .runtime/logs
docker compose up -d booking-worker booking-notification-worker booking-report-worker identity-scheduler club-scheduler booking-scheduler
printf '\nSHIFT: http://localhost:8088 | Admin: /admin/ | Docs: /docs/ | Storybook: http://localhost:6006/\n'
exec pnpm --parallel --filter @shift/web --filter @shift/admin --filter @shift/docs --filter @shift/ui run dev
