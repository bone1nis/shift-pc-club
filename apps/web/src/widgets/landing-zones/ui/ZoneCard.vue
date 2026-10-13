<script setup lang="ts">
import { NuxtLink } from '#components'
import { money } from '@fsd/shared/format'

defineProps<{
  to: string
  index: number
  name: string
  description: string
  hourlyPrice?: number
}>()
const tagline = ['EVERYDAY GAMING', 'MAXIMUM PERFORMANCE', 'TEAM PLAY']
</script>

<template>
  <component :is="NuxtLink" :to="to" class="zone-card" :class="`zone-card--${index % 2}`">
    <div class="zone-card__grid" aria-hidden="true"></div>
    <span class="zone-card__tag">0{{ index + 1 }} / {{ tagline[index] ?? 'TEAM PLAY' }}</span>
    <div class="zone-card__visual" aria-hidden="true">
      <img
        :src="index === 1 ? '/images/club-vip.webp' : '/images/club-hero.webp'"
        alt=""
        loading="lazy"
      />
    </div>
    <div class="zone-card__bottom">
      <div>
        <h3>{{ name }}</h3>
        <p>{{ description }}</p>
        <span v-if="hourlyPrice !== undefined" class="zone-card__price"
          >от {{ money(hourlyPrice) }} <small>/ час</small></span
        >
      </div>
      <span class="zone-card__arrow">↗</span>
    </div>
  </component>
</template>

<style scoped>
.zone-card {
  position: relative;
  min-height: 432px;
  overflow: hidden;
  padding: 26px;
  background: var(--gray-12);
  border: 1px solid var(--olive-20);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s;
}
.zone-card:hover {
  border-color: var(--acid);
}
.zone-card--0 {
  background: var(--olive-12);
}
.zone-card--1 {
  background: var(--blue-14);
}
.zone-card__tag {
  position: relative;
  z-index: 2;
  font-size: var(--fs-9);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--olive-66);
}
.zone-card__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--olive-50-a5) 1px, transparent 1px),
    linear-gradient(90deg, var(--olive-50-a5) 1px, transparent 1px);
  background-size: 32px 32px;
}
.zone-card__visual {
  position: relative;
  height: 256px;
  margin: 24px -26px;
  overflow: hidden;
}
.zone-card__visual img {
  height: 100%;
  width: 100%;
  object-fit: cover;
  transition: transform 0.4s;
}
.zone-card:hover .zone-card__visual img {
  transform: scale(1.06);
}
.zone-card__bottom {
  position: relative;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: end;
  margin-top: auto;
}
.zone-card h3 {
  font-family: var(--font-display);
  font-size: var(--fs-36);
  text-transform: uppercase;
}
.zone-card p {
  font-size: var(--fs-11);
  max-width: 272px;
  color: var(--gray-66);
  margin-top: 8px;
}
.zone-card__price {
  display: block;
  font-weight: 700;
  margin-top: 16px;
  font-size: var(--fs-20);
}
.zone-card__price small {
  font-size: var(--fs-10);
  font-weight: 400;
  color: var(--muted);
}
.zone-card__arrow {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  background: var(--olive-22-a);
  border-radius: 50%;
  font-size: var(--fs-20);
}
@media (max-width: 1050px) {
  .zone-card {
    padding: 19px;
  }
}
@media (max-width: 760px) {
  .zone-card {
    min-height: 400px;
  }
  .zone-card__visual {
    height: 240px;
  }
}
</style>
