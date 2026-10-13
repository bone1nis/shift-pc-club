<script setup lang="ts">
import type { Catalog } from '@shift/contracts'
import { UiIcon, UiNotice } from '@shift/ui'
import { Container, LinkButton, SectionHeading, vReveal } from '@fsd/shared/ui'
import ZoneCard from './ZoneCard.vue'

defineProps<{ catalog: Catalog | null | undefined }>()
</script>

<template>
  <section id="spaces" class="spaces">
    <Container>
      <SectionHeading eyebrow="01 / Твоё пространство">
        <template #title>У каждого<br />свой <span class="outline">уровень.</span></template>
        Один клуб. Разные сценарии.<br />Найди место для своей игры —<br />от вечернего катка до
        командного турнира.
      </SectionHeading>
      <div v-if="catalog" class="spaces__grid">
        <ZoneCard
          v-for="(zone, index) in catalog.zones"
          :key="zone.id"
          v-reveal="index"
          :to="`/booking?zone=${zone.id}`"
          :index="index"
          :name="zone.name"
          :description="zone.description"
          :hourly-price="catalog.tariffs.find((t) => t.zone_id === zone.id)?.hourly_price"
        />
      </div>
      <UiNotice v-else>
        Залы и тарифы загрузятся после подключения сервиса клуба.
        <LinkButton to="/booking" variant="ghost" size="sm"
          >Открыть бронирование <UiIcon name="arrow-up-right"
        /></LinkButton>
      </UiNotice>
    </Container>
  </section>
</template>

<style scoped>
.spaces {
  padding-top: 112px;
  padding-bottom: 48px;
}
.spaces__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 760px) {
  .spaces {
    padding-top: 64px;
  }
  .spaces__grid {
    grid-template-columns: 1fr;
  }
}
</style>
