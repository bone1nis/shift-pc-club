<script setup lang="ts">
import { Container, SectionHeading, vReveal } from '@fsd/shared/ui'

const steps = [
  {
    title: 'Выбери время и места',
    text: 'Открой схему зала, выбери дату, длительность и свободные компьютеры. Можно собрать всю команду.',
  },
  {
    title: 'Подтверди бронь',
    text: 'Стоимость фиксируется сервером в момент брони. Оплата — на месте, онлайн-платежей нет.',
  },
  {
    title: 'Приходи и играй',
    text: 'Администратор заселит тебя по брони за 15 минут до начала и за 15 минут после. Время сессии видно в кабинете.',
  },
]
</script>

<template>
  <section class="steps" aria-labelledby="steps-title">
    <Container>
      <SectionHeading eyebrow="05 / Как это работает">
        <template #title
          ><span id="steps-title">Три шага <span class="outline">до игры.</span></span></template
        >
        Без звонков и очередей: бронь занимает меньше минуты.
      </SectionHeading>
      <ol class="steps__list">
        <li v-for="(step, index) in steps" :key="step.title" v-reveal="index" class="steps__item">
          <span class="steps__number">0{{ index + 1 }}</span>
          <h3>{{ step.title }}</h3>
          <p>{{ step.text }}</p>
        </li>
      </ol>
    </Container>
  </section>
</template>

<style scoped>
.steps {
  padding-top: 80px;
  padding-bottom: 32px;
}
.steps__list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.steps__item {
  padding: 29px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.steps__number {
  font-family: var(--font-display);
  font-size: var(--fs-56);
  line-height: 1;
  color: var(--acid);
}
.steps__item h3 {
  margin: 16px 0 10px;
  font-size: var(--fs-18);
}
.steps__item p {
  font-size: var(--fs-14);
  color: var(--muted);
}
@media (max-width: 760px) {
  .steps {
    padding-top: 48px;
  }
  .steps__list {
    grid-template-columns: 1fr;
  }
}
</style>
