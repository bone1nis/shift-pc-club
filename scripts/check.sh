#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:-all}"
if [[ "$mode" == frontend || "$mode" == all ]]; then
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm test:coverage
  pnpm build
fi
if [[ "$mode" == backend || "$mode" == all ]]; then
  ./scripts/backend.sh lint
  ./scripts/backend.sh analyse
  ./scripts/backend.sh test
fi
