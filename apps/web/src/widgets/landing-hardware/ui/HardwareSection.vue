<script setup lang="ts">
import { UiIcon } from '@shift/ui'
import type { Workstation } from '@shift/contracts'
import { Container, vReveal } from '@fsd/shared/ui'
import { NuxtLink } from '#components'

defineProps<{ workstation?: Workstation }>()
</script>

<template>
  <section id="hardware" class="hardware">
    <Container class="hardware__inner">
      <div v-reveal.left class="hardware__art" aria-hidden="true">
        <span class="hardware__label">Built for your next win</span>
        <div class="hardware__rings"></div>
        <div class="hardware__chip">
          <span>SHIFT</span><b>RTX</b><small>PERFORMANCE INSIDE</small>
        </div>
        <div class="hardware__cross">+</div>
      </div>
      <div v-reveal.right class="hardware__copy">
        <span class="hardware__eyebrow">03 / Без слабых мест</span>
        <h2>Вся мощь.<br />Твой <span class="acid">контроль.</span></h2>
        <p>
          Мы собрали сетап, который не ограничивает твой скилл. Стабильный FPS, быстрый отклик и
          комфорт — всё для того, чтобы ты думал только об игре.
        </p>
        <dl v-if="workstation" class="spec-list">
          <div>
            <dt>Видеокарта</dt>
            <dd>{{ workstation.specs.gpu }}</dd>
          </div>
          <div>
            <dt>Процессор</dt>
            <dd>{{ workstation.specs.cpu }}</dd>
          </div>
          <div>
            <dt>Монитор</dt>
            <dd>{{ workstation.specs.monitor }}</dd>
          </div>
          <div>
            <dt>Память</dt>
            <dd>{{ workstation.specs.ram }}</dd>
          </div>
        </dl>
        <component :is="NuxtLink" class="hardware__link" to="/booking"
          >Выбрать свой сетап <UiIcon name="arrow-up-right"
        /></component>
      </div>
    </Container>
  </section>
</template>

<style scoped>
.hardware {
  padding-top: 80px;
  padding-bottom: 80px;
}
.hardware__inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 96px;
  align-items: center;
}
.acid {
  color: var(--acid);
}
.hardware__eyebrow {
  display: block;
  margin-bottom: 22px;
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--acid);
}
.hardware__art {
  aspect-ratio: 1;
  background: radial-gradient(
    ellipse at center,
    var(--olive-15) 0%,
    var(--olive-10-a) 38%,
    var(--bg) 70%
  );
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.hardware__rings {
  position: absolute;
  inset: 10%;
  border: 1px solid var(--olive-22);
  border-radius: 50%;
  box-shadow:
    0 0 0 48px var(--olive-15-b-a20),
    0 0 0 96px var(--olive-15-b-a11);
  transform: rotate(-25deg) scaleY(0.7);
}
.hardware__chip {
  width: 240px;
  height: 288px;
  border: 1px solid var(--olive-30-a);
  background: linear-gradient(130deg, var(--olive-25), var(--olive-8));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: rotate(-13deg);
  box-shadow:
    16px 16px 0 var(--olive-5),
    24px 24px 0 var(--olive-18),
    0 32px 96px var(--black);
}
.hardware__chip span {
  font-family: var(--font-display);
  font-size: var(--fs-48);
  color: var(--acid);
}
.hardware__chip b {
  font-family: var(--font-display);
  font-size: var(--fs-80);
}
.hardware__chip small {
  font-size: var(--fs-9);
  letter-spacing: 0.2em;
  color: var(--muted);
}
.hardware__label {
  position: absolute;
  top: 32px;
  left: 32px;
  color: var(--muted);
  font-size: var(--fs-9);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
}
.hardware__cross {
  position: absolute;
  right: 48px;
  bottom: 32px;
  font-size: var(--fs-32);
  color: var(--acid);
}
.hardware__copy p {
  margin: 32px 0;
  font-size: var(--fs-14);
  max-width: 480px;
  color: var(--muted);
}
.spec-list {
  display: grid;
  gap: 16px;
  margin: 0;
  font-size: var(--fs-12);
}
.spec-list > div {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
  padding-bottom: 16px;
  gap: 16px;
}
.spec-list dt {
  color: var(--muted);
}
.spec-list dd {
  margin: 0;
  font-weight: 700;
  text-align: right;
}
.hardware__link {
  display: inline-block;
  margin-top: 32px;
  font-size: var(--fs-13);
  color: var(--acid);
  font-weight: 700;
}
@media (max-width: 1050px) {
  .hardware__inner {
    gap: 32px;
  }
}
@media (max-width: 760px) {
  .hardware {
    padding-top: 32px;
    padding-bottom: 0;
  }
  .hardware__inner {
    grid-template-columns: 1fr;
  }
  .hardware__art {
    max-height: 400px;
  }
  .hardware__copy h2 {
    font-size: var(--fs-56);
  }
}
</style>
