<script setup lang="ts">
import { ref } from 'vue'
import { UiDisclosure } from '@shift/ui'
import { Container, SectionHeading, vReveal } from '@fsd/shared/ui'

const faq = [
  {
    q: 'Нужно ли платить при бронировании?',
    a: 'Нет. Бронь не требует предоплаты: стоимость фиксируется при бронировании, а платите вы администратору в клубе.',
  },
  {
    q: 'Можно ли отменить бронь?',
    a: 'Да, до её начала — в личном кабинете. Если не прийти в течение 15 минут после начала, бронь освобождается автоматически.',
  },
  {
    q: 'Можно ли прийти без брони?',
    a: 'Можно, если есть свободные места: администратор запустит сессию на месте. Чтобы не ждать, лучше забронировать заранее.',
  },
  {
    q: 'Как продлить время или пересесть?',
    a: 'Скажите администратору: он продлит сессию или пересадит вас на свободный компьютер той же зоны, если место не занято чужой бронью.',
  },
  {
    q: 'Что входит в стоимость?',
    a: 'Игровое место, периферия и гарнитура. Напитки и еда из бара оплачиваются отдельно.',
  },
  {
    q: 'Что с моими данными?',
    a: 'Мы храним имя, email и историю броней. Это демонстрационный проект: не указывайте реальные персональные данные.',
  },
]
const open = ref<number | null>(0)
</script>

<template>
  <section id="faq" class="faq" aria-labelledby="faq-title">
    <Container>
      <SectionHeading eyebrow="07 / Частые вопросы">
        <template #title
          ><span id="faq-title">Всё, что <span class="outline">спрашивают.</span></span></template
        >
        Не нашли ответ — спросите администратора по телефону или на месте.
      </SectionHeading>
      <div class="faq__list">
        <UiDisclosure
          v-for="(item, index) in faq"
          :key="item.q"
          v-reveal="index"
          :model-value="open === index"
          :title="item.q"
          @update:model-value="open = $event ? index : null"
        >
          {{ item.a }}
        </UiDisclosure>
      </div>
    </Container>
  </section>
</template>

<style scoped>
.faq {
  padding-top: 80px;
  padding-bottom: 48px;
}
@media (max-width: 760px) {
  .faq {
    padding-top: 48px;
  }
}
</style>
