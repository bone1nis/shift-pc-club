<script setup lang="ts">
import type { Catalog } from '@shift/contracts'
import { Container, SectionHeading, vReveal } from '@fsd/shared/ui'
import PriceCard from './PriceCard.vue'

defineProps<{ catalog: Catalog | null | undefined }>()
</script>

<template>
  <section id="prices" class="pricing">
    <Container>
      <SectionHeading eyebrow="04 / Честные тарифы">
        <template #title>Больше игры.<br />Меньше <span class="outline">границ.</span></template>
        Выбирай зал и время.<br />Стоимость фиксируется при бронировании.
      </SectionHeading>
      <div v-if="catalog" class="pricing__grid">
        <PriceCard
          v-for="(tariff, index) in catalog.tariffs"
          :key="tariff.id"
          v-reveal.zoom="index"
          :zone="catalog.zones.find((z) => z.id === tariff.zone_id)?.name ?? ''"
          :name="tariff.name"
          :hourly-price="tariff.hourly_price"
          :to="`/booking?zone=${tariff.zone_id}`"
          :featured="index === 1"
        />
      </div>
    </Container>
  </section>
</template>

<style scoped>
.pricing {
  padding-top: 112px;
  padding-bottom: 48px;
}
.pricing__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 760px) {
  .pricing {
    padding-top: 64px;
  }
  .pricing__grid {
    grid-template-columns: 1fr;
  }
}
</style>
