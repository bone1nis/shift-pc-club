<script setup lang="ts">
import { UiIcon } from '@shift/ui'
import { motion } from 'motion-v'
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import { Container, LinkButton } from '@fsd/shared/ui'

defineProps<{ seatCount?: number }>()
const hero = ref<HTMLElement | null>(null)
// Параллакс: фон смещается медленнее страницы. Пока герой не виден, ничего не считается.
useEventListener(
  'scroll',
  () => {
    const el = hero.value
    if (el && window.scrollY < el.offsetHeight)
      el.style.setProperty('--hero-shift', `${window.scrollY * 0.22}px`)
  },
  { passive: true },
)
const phrases = ['PLAY HARD', 'STAY FOCUSED', 'GO NEXT LEVEL', 'SHIFT YOUR GAME']
</script>

<template>
  <section ref="hero" class="hero">
    <div class="hero__photo" role="img" aria-label="Концепция игрового зала SHIFT"></div>
    <div class="hero__shade"></div>
    <Container class="hero__content">
      <div class="hero__topline">
        <span class="eyebrow"><span class="acid">●</span> Gaming is a lifestyle</span
        ><span class="eyebrow hero__coordinates">55°45′ N / 37°37′ E</span>
      </div>
      <motion.div :initial="false" :animate="{ opacity: 1 }" :transition="{ duration: 0.7 }"
        ><h1>Меняй<br />правила.<br /><span class="acid">Играй в SHIFT.</span></h1>
        <p class="hero__copy">
          Топовое железо. Своя команда. Полное погружение.<br />Пространство, в котором ты на
          уровень выше.
        </p>
        <div class="hero__actions">
          <LinkButton to="/booking">Забронировать место <UiIcon name="arrow-up-right" /></LinkButton
          ><a class="hero__explore" href="#spaces">Открыть клуб <span>↓</span></a>
        </div></motion.div
      >
      <div class="hero__bottom">
        <div>
          <span class="hero__stat">24<span class="acid">/</span>7</span
          ><span class="eyebrow">В твоём ритме</span>
        </div>
        <div>
          <span class="hero__stat">{{ seatCount || '—' }}</span
          ><span class="eyebrow">Игровых мест</span>
        </div>
        <div>
          <span class="hero__stat">144+</span><span class="eyebrow">FPS — без компромиссов</span>
        </div>
        <span class="hero__scroll eyebrow">Scroll to explore ↓</span>
      </div>
    </Container>
    <div class="hero__number">01 / NEXT LEVEL</div>
  </section>
  <div class="ticker" aria-hidden="true">
    <div class="ticker__track">
      <div v-for="copy in 6" :key="copy" class="ticker__group">
        <template v-for="phrase in phrases" :key="phrase"
          ><span>{{ phrase }}</span
          ><b>↗</b></template
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.eyebrow {
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
}
.acid {
  color: var(--acid);
}
.hero {
  min-height: 752px;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-top: 1px solid var(--line);
}
.hero__photo {
  position: absolute;
  inset: 0;
  background: url('/images/club-hero.webp') center 55% / cover;
  z-index: -3;
  translate: 0 var(--hero-shift, 0px);
  animation: hero-zoom 22s ease-in-out infinite alternate;
}
@keyframes hero-zoom {
  from {
    scale: 1.02;
  }
  to {
    scale: 1.12;
  }
}
.hero__shade {
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    linear-gradient(90deg, var(--green-4-a98) 0%, var(--green-4-a86) 25%, var(--green-4-a16) 75%),
    linear-gradient(0deg, var(--bg) 0%, transparent 33%);
}
.hero__content {
  padding-top: 32px;
}
.hero__topline {
  display: flex;
  justify-content: space-between;
  margin-bottom: 62px;
}
.hero__coordinates {
  color: var(--olive-80);
}
.hero h1 {
  font-size: var(--fs-fluid-77-133);
  max-width: 928px;
}
.hero__copy {
  margin-top: 30px;
  color: var(--gray-75);
  font-size: var(--fs-14);
}
.hero__actions {
  display: flex;
  gap: 32px;
  align-items: center;
  margin-top: 38px;
}
.hero__actions :deep(.button) {
  gap: 40px;
}
.hero__explore {
  font-size: var(--fs-12);
  display: flex;
  gap: 26px;
}
.hero__bottom {
  margin-top: 68px;
  display: flex;
  align-items: center;
  gap: 59px;
  padding-bottom: 40px;
}
.hero__bottom > div {
  display: grid;
  gap: 11px;
}
.hero__stat {
  font-family: var(--font-display);
  font-size: var(--fs-56);
  line-height: 1;
}
.hero__bottom .eyebrow {
  font-size: var(--fs-9);
  color: var(--muted);
}
.hero__scroll {
  margin-left: auto;
}
.hero__number {
  position: absolute;
  right: 16px;
  top: 50%;
  writing-mode: vertical-rl;
  font-size: var(--fs-9);
  letter-spacing: 0.2em;
  color: var(--olive-70);
}
.ticker {
  background: var(--acid);
  color: var(--acid-ink);
  padding: 18px 0;
  overflow: hidden;
  white-space: nowrap;
  font-family: var(--font-display);
  font-size: var(--fs-28);
}
/* Бесшовная бегущая строка: шесть одинаковых групп, лента сдвигается ровно на одну из шести. */
.ticker__track {
  display: flex;
  width: max-content;
  animation: ticker 28s linear infinite;
}
.ticker:hover .ticker__track {
  animation-play-state: paused;
}
.ticker__group {
  display: flex;
  flex: none;
  align-items: center;
  gap: 32px;
  padding-right: 32px;
}
.ticker b {
  font-family: Arial, sans-serif;
  font-size: var(--fs-28);
}
@keyframes ticker {
  to {
    transform: translateX(calc(-100% / 6));
  }
}
@media (prefers-reduced-motion: reduce) {
  .ticker__track {
    animation: none;
  }
}
@media (min-width: 1500px) {
  .hero {
    min-height: 848px;
  }
  .hero__content {
    padding-top: 48px;
  }
  .hero__bottom {
    margin-top: 80px;
  }
}
@media (max-width: 1050px) {
  .hero__coordinates {
    display: none;
  }
}
@media (max-width: 760px) {
  .hero {
    min-height: 688px;
  }
  .hero__content {
    padding-top: 29px;
  }
  .hero__photo {
    background-position: 65% center;
  }
  .hero__shade {
    background:
      linear-gradient(90deg, var(--green-5-a95), var(--green-5-a44)),
      linear-gradient(0deg, var(--bg), transparent 70%);
  }
  .hero__topline {
    margin-bottom: 48px;
  }
  .hero h1 {
    font-size: var(--fs-72);
  }
  .hero__copy {
    font-size: var(--fs-12);
  }
  .hero__actions {
    gap: 16px;
    align-items: start;
    flex-direction: column;
  }
  .hero__actions :deep(.button) {
    font-size: var(--fs-11);
  }
  .hero__explore {
    margin-top: 13px;
  }
  .hero__bottom {
    margin-top: 56px;
    gap: 29px;
  }
  .hero__stat {
    font-size: var(--fs-48);
  }
  .hero__bottom .eyebrow {
    font-size: var(--fs-9);
  }
  .hero__scroll,
  .hero__number {
    display: none;
  }
  .ticker {
    font-size: var(--fs-22);
    padding: 16px 0;
  }
  .ticker__group {
    gap: 24px;
    padding-right: 24px;
  }
}
</style>
