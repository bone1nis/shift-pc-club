<script setup lang="ts">
import { UiIcon } from '@shift/ui'
import { money } from '@fsd/shared/format'
import { LinkButton } from '@fsd/shared/ui'

defineProps<{ zone: string; name: string; hourlyPrice: number; to: string; featured?: boolean }>()
</script>

<template>
  <article class="price-card" :class="{ 'price-card--featured': featured }">
    <div class="price-card__top">
      <span class="price-card__zone">{{ zone }}</span
      ><span v-if="featured" class="price-card__badge">NEXT LEVEL</span>
    </div>
    <h3>{{ name }}</h3>
    <div class="price-card__price">{{ money(hourlyPrice) }}<small>/ час</small></div>
    <hr class="price-card__divider" />
    <p class="price-card__perks">
      ✓ Выбор конкретного места<br />✓ Бронирование для себя и команды<br />✓ Стоимость без
      сюрпризов
    </p>
    <LinkButton :to="to" :variant="featured ? 'primary' : 'ghost'" block
      >Выбрать место <UiIcon name="arrow-up-right"
    /></LinkButton>
  </article>
</template>

<style scoped>
.price-card {
  padding: 32px;
  border: 1px solid var(--line);
  background: var(--gray-10);
  border-radius: var(--radius-sm);
}
.price-card--featured {
  border-color: var(--olive-43);
  background: linear-gradient(150deg, var(--olive-15-a), var(--gray-10));
}
.price-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}
.price-card__zone {
  font-size: var(--fs-10);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
}
.price-card__badge {
  background: var(--acid);
  color: var(--olive-6);
  padding: 6px 8px;
  font-size: var(--fs-9);
  font-weight: 800;
}
.price-card h3 {
  font-family: var(--font-display);
  font-size: var(--fs-32);
  text-transform: uppercase;
  margin-top: 32px;
}
.price-card__price {
  font-family: var(--font-display);
  font-size: var(--fs-64);
  margin-top: 16px;
  line-height: 1;
}
.price-card__price small {
  font-family: var(--font-sans);
  font-size: var(--fs-11);
  color: var(--muted);
  margin-left: 8px;
}
.price-card__divider {
  border: 0;
  border-top: 1px solid var(--line);
  margin: 24px 0;
}
.price-card__perks {
  font-size: var(--fs-13);
  color: var(--muted);
}
.price-card :deep(.button) {
  margin-top: 32px;
  font-size: var(--fs-12);
}
@media (max-width: 760px) {
  .price-card {
    padding: 24px;
  }
  .price-card__price {
    font-size: var(--fs-56);
  }
}
</style>
