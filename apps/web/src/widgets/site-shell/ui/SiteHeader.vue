<script setup lang="ts">
import { useRoute } from '#imports'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useScrollLock, useWindowScroll } from '@vueuse/core'
import { UiIcon, UiLogo } from '@shift/ui'
import { useUserStore } from '@fsd/entities/user'
import { Container, LinkButton } from '@fsd/shared/ui'

const store = useUserStore()
const open = ref(false)
const { y: scrollY } = useWindowScroll()
const scrolled = computed(() => scrollY.value > 24)
const mobileLinks = [
  ['/#spaces', 'Клуб'],
  ['/#hardware', 'Оснащение'],
  ['/#prices', 'Тарифы'],
  ['/#contacts', 'Контакты'],
  ['/account', 'Личный кабинет'],
] as const
const route = useRoute()
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}
onMounted(() => {
  if (!store.loaded) void store.load()
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
})
// Пока меню открыто, страница под ним не прокручивается (блокировка снимается сама при уходе со страницы).
const locked = useScrollLock(typeof document === 'undefined' ? null : document.documentElement)
watch(open, (value) => {
  locked.value = value
})
watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)
</script>

<template>
  <a class="skip-link" href="#main">Перейти к содержанию</a>
  <div class="site-header-wrap" :class="{ 'site-header-wrap--scrolled': scrolled || open }">
    <Container>
      <header class="site-header">
        <NuxtLink class="site-header__brand" to="/" aria-label="SHIFT — на главную"
          ><UiLogo size="lg"
        /></NuxtLink>
        <nav class="site-header__nav" aria-label="Основная навигация">
          <NuxtLink to="/#spaces">Клуб</NuxtLink><NuxtLink to="/#hardware">Оснащение</NuxtLink
          ><NuxtLink to="/#prices">Тарифы</NuxtLink><NuxtLink to="/#contacts">Контакты</NuxtLink>
        </nav>
        <div class="site-header__actions">
          <span class="site-header__open"><i></i> Открыты 24/7</span
          ><NuxtLink
            class="site-header__account"
            :to="store.user ? '/account' : '/auth'"
            aria-label="Личный кабинет"
            ><UiIcon name="user" size="22px" :stroke="1.6" /></NuxtLink
          ><LinkButton class="site-header__book" to="/booking" size="sm"
            >Бронировать <UiIcon name="arrow-up-right" /></LinkButton
          ><button
            class="site-header__toggle"
            type="button"
            :aria-expanded="open"
            aria-controls="mobile-nav"
            aria-label="Меню"
            @click="open = !open"
          >
            <UiIcon :name="open ? 'x' : 'menu'" size="24px" :stroke="1.6" />
          </button>
        </div>
        <Transition name="menu">
          <nav
            v-if="open"
            id="mobile-nav"
            class="site-header__mobile"
            aria-label="Мобильная навигация"
          >
            <NuxtLink
              v-for="([to, label], index) in mobileLinks"
              :key="to"
              :to="to"
              :style="{ '--i': index }"
              @click="open = false"
              >{{ label }}</NuxtLink
            >
            <LinkButton to="/booking" class="site-header__mobile-book" @click="open = false"
              >Забронировать <UiIcon name="arrow-up-right"
            /></LinkButton>
            <span class="site-header__mobile-note">Открыты 24/7 · Санкт-Петербург</span>
          </nav>
        </Transition>
      </header>
    </Container>
  </div>
</template>

<style scoped>
.skip-link {
  position: absolute;
  top: -80px;
  left: 16px;
  background: var(--acid);
  color: var(--gray-7);
  padding: 16px;
  z-index: 100;
}
.skip-link:focus {
  top: 16px;
}
.site-header-wrap {
  position: sticky;
  top: 0;
  z-index: 50;
}
/* Размытый фон — отдельным слоем: backdrop-filter на самой обёртке сломал бы fixed-меню внутри. */
.site-header-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--bg-a85);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(14px);
  opacity: 0;
  transition: opacity 0.3s ease;
}
.site-header-wrap--scrolled::before {
  opacity: 1;
}
/* Полоска прогресса прокрутки (где браузер поддерживает scroll-driven animations). */
@supports (animation-timeline: scroll()) {
  .site-header-wrap::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: var(--acid);
    transform-origin: left;
    animation: header-progress linear both;
    animation-timeline: scroll(root);
  }
}
@keyframes header-progress {
  from {
    transform: scaleX(0);
  }
}
.site-header {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  position: relative;
  z-index: 20;
}
.site-header__nav {
  display: flex;
  gap: 38px;
  font-size: var(--fs-15);
  font-weight: 500;
  color: var(--olive-88);
}
.site-header__nav a:hover {
  color: var(--acid);
}
.site-header__actions {
  display: flex;
  align-items: center;
  gap: 26px;
}
.site-header__open {
  font-size: var(--fs-13);
  color: var(--muted);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
}
.site-header__open i {
  height: 6px;
  width: 6px;
  background: var(--acid);
  border-radius: 50%;
}
.site-header__account,
.site-header__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  transition:
    background 0.2s,
    color 0.2s;
}
.site-header__account:hover,
.site-header__toggle:hover {
  background: var(--white-a8);
  color: var(--acid);
}

.site-header__book {
  gap: 26px;
}
.site-header__toggle {
  display: none;
  background: none;
  border: 0;
  color: var(--text);
}
.site-header__brand,
.site-header__actions {
  position: relative;
  z-index: 2;
}
/* Мобильное меню — чёрная панель на весь экран; пункты выезжают по очереди. */
.site-header__mobile {
  position: fixed;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 96px 24px 32px;
  background: var(--black);
  overflow-y: auto;
}
.site-header__mobile a:not(.site-header__mobile-book) {
  padding: 11px 0;
  font-family: var(--font-display);
  font-size: var(--fs-fluid-32-48);
  font-weight: 800;
  line-height: 1.1;
  text-transform: uppercase;
  border-bottom: 1px solid var(--line);
  transition: color 0.2s;
}
.site-header__mobile a:hover {
  color: var(--acid);
}
.site-header__mobile-book {
  margin-top: 24px;
  justify-content: center;
}
.site-header__mobile-note {
  margin-top: 16px;
  font-size: var(--fs-13);
  color: var(--muted);
}
.menu-enter-active,
.menu-leave-active {
  transition:
    opacity 0.3s ease,
    clip-path 0.45s cubic-bezier(0.7, 0, 0.2, 1);
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  clip-path: circle(0% at calc(100% - 40px) 40px);
}
.menu-enter-to,
.menu-leave-from {
  clip-path: circle(150% at calc(100% - 40px) 40px);
}
.menu-enter-active a,
.menu-enter-active .site-header__mobile-note {
  animation: menu-item 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  animation-delay: calc(0.12s + var(--i, 5) * 0.06s);
}
@keyframes menu-item {
  from {
    opacity: 0;
    transform: translateY(19px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .menu-enter-active,
  .menu-leave-active,
  .menu-enter-active a {
    transition: none;
    animation: none;
  }
}
@media (max-width: 1050px) {
  .site-header__nav {
    display: none;
  }
  .site-header__actions {
    gap: 16px;
  }
}
@media (max-width: 760px) {
  .site-header {
    height: 80px;
    gap: 16px;
  }
  /* Селектор усилен (.site-header), чтобы правило выигрывало у display кнопки при любом порядке загрузки CSS. */
  .site-header .site-header__open,
  .site-header .site-header__book {
    display: none;
  }
  .site-header__toggle {
    display: block;
  }
  .site-header__actions {
    gap: 4px;
  }
}
</style>
