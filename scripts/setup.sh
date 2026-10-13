#!/usr/bin/env bash
# Подготовка к разработке на этой машине: окружение и ключи, зависимости (pnpm), образ PHP, базы, миграции и сидеры,
# изоляция тестовых баз. Фронтенд после этого запускается командой ./scripts/dev.sh (с горячей перезагрузкой).
# Для запуска «всё в Docker» без Node на машине используйте ./scripts/start.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo 'Установите Node 22 (nvm use).'; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0]) < 22) { console.error("Нужен Node 22: выполните nvm use 22"); process.exit(1); }'
node scripts/bootstrap.mjs
pnpm install --frozen-lockfile
./scripts/backend-init.sh
python3 scripts/isolate-test-databases.py
printf '\nBackend готов. Для фронтенда запустите ./scripts/dev.sh\n'
