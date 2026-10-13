# Продакшен-образы фронтенда: сайт (Nuxt, Node) и статика (админка, документация) за nginx.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY packages/ui/package.json packages/ui/
COPY packages/contracts/package.json packages/contracts/
COPY docs/package.json docs/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm --filter @shift/web exec nuxt prepare \
 && pnpm --filter @shift/web build \
 && pnpm --filter @shift/admin build \
 && pnpm --filter @shift/ui build-storybook \
 && pnpm --filter @shift/docs build

FROM node:22-alpine AS web
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /app/apps/web/.output ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "server/index.mjs"]

FROM nginx:1.27-alpine AS static
COPY infra/node/static.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html/admin
COPY --from=build /app/docs/.vitepress/dist /usr/share/nginx/html/docs
COPY --from=build /app/packages/ui/storybook-static /usr/share/nginx/html/storybook
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/admin/ >/dev/null || exit 1
