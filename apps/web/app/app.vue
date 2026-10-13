<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>

<style scoped>
/* Плавный переход между страницами; при prefers-reduced-motion длительности сводятся к нулю в tokens.css. */
:global(.page-enter-active),
:global(.page-leave-active) {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease;
}
:global(.page-enter-from) {
  opacity: 0;
  transform: translateY(14px);
}
:global(.page-leave-to) {
  opacity: 0;
  transform: translateY(-6px);
}

/* Появление блоков при прокрутке (директива v-reveal). Используются свойства translate/scale, поэтому
   собственные transform-эффекты блоков (наведение) им не мешают. */
:global(.reveal) {
  opacity: 0;
}
:global(.reveal.is-in) {
  /* !important: у некоторых компонентов (например, UiPanel) есть своя анимация появления, она не должна оставить блок прозрачным. */
  animation: reveal-up 0.85s cubic-bezier(0.2, 0.7, 0.2, 1) var(--reveal-delay, 0ms) both !important;
}
:global(.reveal--left.is-in) {
  animation-name: reveal-left !important;
}
:global(.reveal--right.is-in) {
  animation-name: reveal-right !important;
}
:global(.reveal--zoom.is-in) {
  animation-name: reveal-zoom !important;
}
@keyframes reveal-up {
  from {
    opacity: 0;
    translate: 0 40px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
@keyframes reveal-left {
  from {
    opacity: 0;
    translate: -48px 0;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
@keyframes reveal-right {
  from {
    opacity: 0;
    translate: 48px 0;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
@keyframes reveal-zoom {
  from {
    opacity: 0;
    scale: 0.92;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}
</style>
