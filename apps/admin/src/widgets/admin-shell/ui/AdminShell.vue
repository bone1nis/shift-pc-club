<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useScrollLock } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { UiButton, UiEmpty, UiIcon, UiLogo, UiNotice, UiStatus } from '@shift/ui'
import type { IconName } from '@shift/ui'
import { useOperationsStore } from '@fsd/entities/operations'
import { useUserStore } from '@fsd/entities/user'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const ops = useOperationsStore()
const REFRESH_MS = 30_000
const menu = ref(false)

const links: ReadonlyArray<readonly [string, IconName, string]> = [
  ['/', 'layout-dashboard', 'Смена'],
  ['/schedule', 'calendar-days', 'Расписание'],
  ['/equipment', 'cpu', 'Оборудование'],
  ['/tariffs', 'banknote', 'Тарифы'],
  ['/club', 'house', 'Профиль клуба'],
  ['/users', 'users', 'Посетители'],
  ['/reports', 'trending-up', 'Отчёты'],
  ['/notifications', 'mail', 'Уведомления'],
  ['/processing', 'settings', 'Обработка'],
  ['/audit', 'list', 'История действий'],
]
const title = computed(() => String(route.meta.title ?? 'Смена'))

async function logout() {
  await user.logout()
  await router.push('/login')
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void ops.refresh()
  timer = setInterval(() => {
    if (!ops.pending) void ops.refresh()
  }, REFRESH_MS)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
watch(
  () => route.path,
  () => {
    menu.value = false
    void ops.refresh()
  },
)
const locked = useScrollLock(document.documentElement)
watch(menu, (value) => {
  locked.value = value
})
</script>

<template>
  <div class="shell">
    <header class="shell__mobilebar">
      <a href="/" class="shell__brand" aria-label="SHIFT — открыть сайт"><UiLogo /></a>
      <strong class="shell__mobiletitle">{{ title }}</strong>
      <button
        type="button"
        class="shell__burger"
        :aria-expanded="menu"
        aria-controls="admin-nav"
        aria-label="Меню"
        @click="menu = !menu"
      >
        <UiIcon :name="menu ? 'x' : 'menu'" size="24px" :stroke="1.6" />
      </button>
    </header>
    <div v-if="menu" class="shell__scrim" @click="menu = false"></div>
    <aside id="admin-nav" class="shell__sidebar" :class="{ 'shell__sidebar--open': menu }">
      <a href="/" class="shell__brand" aria-label="SHIFT — открыть сайт"><UiLogo /></a>
      <span class="shell__label">Club control / Администратор</span>
      <nav class="shell__nav" aria-label="Управление клубом">
        <RouterLink v-for="[path, icon, label] in links" :key="path" :to="path" class="shell__link">
          <UiIcon :name="icon" size="18px" :stroke="1.8" />{{ label }}
        </RouterLink>
      </nav>
      <div class="shell__account">
        <span>{{ user.user?.name }}</span>
        <span class="shell__muted">{{ user.user?.email }}</span>
        <UiButton variant="ghost" block @click="logout">Выйти</UiButton>
        <a href="/docs/admin/" class="shell__muted">Руководство <UiIcon name="arrow-up-right" /></a>
      </div>
    </aside>
    <div class="shell__main">
      <header class="shell__topbar">
        <span class="shell__eyebrow">SHIFT / Операционная панель</span>
        <div class="shell__topbar-right">
          <UiStatus tone="success">Локальный клуб</UiStatus>
          <a href="/" class="shell__muted">Открыть сайт <UiIcon name="arrow-up-right" /></a>
        </div>
      </header>
      <main id="main" class="shell__content">
        <header class="shell__heading">
          <div>
            <span class="shell__eyebrow shell__eyebrow--acid">SHIFT / Операционная панель</span>
            <h1>{{ title }}</h1>
            <p class="shell__muted">Данные обновляются автоматически каждые 30 секунд.</p>
          </div>
          <UiButton variant="secondary" :loading="ops.loading" @click="ops.refresh"
            >Обновить</UiButton
          >
        </header>
        <div v-if="ops.notice || ops.error" class="shell__banners">
          <UiNotice v-if="ops.notice">{{ ops.notice }}</UiNotice>
          <UiNotice v-if="ops.error" tone="error">
            {{ ops.error }}
            <UiButton variant="ghost" size="sm" @click="ops.refresh">Повторить</UiButton>
          </UiNotice>
        </div>
        <UiEmpty v-if="ops.loading && !ops.catalog" role="status"
          >Загружаем состояние клуба…</UiEmpty
        >
        <Transition v-else name="page" mode="out-in">
          <div :key="route.path" class="shell__page"><RouterView /></div>
        </Transition>
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
}
.shell__sidebar {
  min-width: 0;
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 26px;
  padding: 22px 14px;
  background: var(--gray-9);
  border-right: 1px solid var(--line);
}
.shell__brand {
  align-self: flex-start;
}
.shell__label {
  font-size: var(--fs-10);
  line-height: 1.5;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
}
.shell__nav {
  display: grid;
  gap: 6px;
}
.shell__link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--muted);
  font-size: var(--fs-13);
  font-weight: 700;
}
.shell__link .icon {
  color: var(--acid);
}
.shell__link:hover,
.shell__link.router-link-exact-active {
  color: var(--text);
  background: var(--surface);
  border-color: var(--line);
}
.shell__link.router-link-exact-active {
  box-shadow: inset 2px 0 var(--acid);
}
.shell__account {
  display: grid;
  gap: 10px;
  margin-top: auto;
  font-size: var(--fs-13);
}
.shell__muted {
  font-size: var(--fs-13);
  color: var(--muted);
}
.shell__main {
  min-width: 0;
}
.shell__topbar {
  min-height: 67px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 24px;
  border-bottom: 1px solid var(--line);
  background: var(--gray-9);
}
.shell__topbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.shell__eyebrow {
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--muted);
}
.shell__eyebrow--acid {
  color: var(--acid);
}
.shell__content {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  max-width: 1600px;
  margin: 0 auto;
  padding: 24px;
  align-content: start;
}
/* Сообщения «плавают» над страницей и не входят в поток: появление и исчезновение не сдвигает содержимое. */
.shell__banners {
  position: fixed;
  top: 16px;
  right: 24px;
  z-index: 70;
  display: grid;
  gap: 8px;
  width: min(544px, calc(100vw - 32px));
  box-shadow: 0 13px 26px var(--black-a40);
}
.shell__page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  align-content: start;
}
.page-enter-active,
.page-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.shell__heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
}
.shell__heading h1 {
  font-size: var(--fs-fluid-38-64);
  margin: 10px 0;
}
.shell__mobilebar,
.shell__scrim {
  display: none;
}
@media (max-width: 800px) {
  /* Не grid: у sticky-элемента в сетке область прилипания ограничена его ячейкой, и панель уезжала бы вверх при прокрутке. */
  .shell {
    display: block;
  }
  .shell__mobilebar {
    position: sticky;
    top: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 13px;
    height: 61px;
    padding: 0 10px 0 16px;
    background: var(--gray-9);
    border-bottom: 1px solid var(--line);
  }
  .shell__mobilebar .shell__brand {
    display: flex;
    align-items: center;
    align-self: center;
  }
  .shell__mobilebar :deep(.logo) {
    font-size: var(--fs-24);
  }
  .shell__mobiletitle {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--fs-14);
    text-align: right;
  }
  .shell__burger {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex: none;
    background: none;
    border: 0;
    border-radius: 50%;
    color: var(--text);
  }
  .shell__scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 64;
    background: var(--black-a60);
    animation: scrim-in 0.25s ease both;
  }
  @keyframes scrim-in {
    from {
      opacity: 0;
    }
  }
  /* Меню выезжает слева как выдвижная панель. */
  .shell__sidebar {
    position: fixed;
    z-index: 65;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(288px, 85vw);
    height: auto;
    overflow-y: auto;
    padding: 19px 14px;
    transform: translateX(-100%);
    visibility: hidden;
    transition:
      transform 0.3s cubic-bezier(0.7, 0, 0.2, 1),
      visibility 0.3s;
  }
  .shell__sidebar--open {
    transform: none;
    visibility: visible;
  }
  .shell__topbar {
    display: none;
  }
  .shell__content {
    padding: 16px;
  }
  .shell__banners {
    top: 70px;
    right: 16px;
  }
  .shell__heading {
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .shell__heading h1 {
    font-size: var(--fs-36);
  }
}
@media (prefers-reduced-motion: reduce) {
  .shell__sidebar {
    transition: none;
  }
}
</style>
