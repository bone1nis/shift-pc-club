<script setup lang="ts">
import { UiIcon } from '@shift/ui'
import { Container, LinkButton, vReveal } from '@fsd/shared/ui'
</script>

<template>
  <Container>
    <section v-reveal.zoom class="final-cta">
      <span class="final-cta__eyebrow">Твоя команда уже ждёт</span>
      <h2>Пора нажать<br /><span>START.</span></h2>
      <LinkButton to="/booking">Войти в игру <UiIcon name="arrow-up-right" /></LinkButton>
      <div class="final-cta__symbol" aria-hidden="true">↗</div>
    </section>
  </Container>
</template>

<style scoped>
.final-cta {
  margin-top: 80px;
  margin-bottom: 80px;
  border-top: 1px solid var(--line);
  padding-top: 64px;
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
.final-cta__eyebrow {
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--muted);
}
.final-cta h2 {
  font-size: var(--fs-fluid-80-160);
  margin: 27px 0 32px;
}
.final-cta h2 span {
  color: var(--acid);
}
.final-cta__symbol {
  position: absolute;
  right: 64px;
  top: 32px;
  font-family: Arial, sans-serif;
  font-size: var(--fs-384);
  line-height: 1;
  color: var(--olive-13);
  transform: rotate(-7deg);
  z-index: -1;
}
@media (max-width: 760px) {
  .final-cta {
    margin: 48px auto;
  }
  .final-cta__symbol {
    right: -32px;
    font-size: var(--fs-288);
    top: 64px;
  }
}
</style>
