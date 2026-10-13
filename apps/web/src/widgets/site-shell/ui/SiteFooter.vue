<script setup lang="ts">
import { UiIcon, UiLogo } from '@shift/ui'
import { useClubProfile } from '@fsd/entities/club'
import { Container, LinkButton } from '@fsd/shared/ui'

const year = new Date().getFullYear()
const { data: profile } = await useClubProfile()
</script>

<template>
  <footer class="site-footer">
    <Container>
      <div class="site-footer__top">
        <NuxtLink to="/" aria-label="SHIFT — на главную"><UiLogo size="lg" /></NuxtLink>
        <p>Место, где игра становится больше.</p>
        <LinkButton to="/booking" variant="ghost"
          >Твой следующий уровень <UiIcon name="arrow-up-right"
        /></LinkButton>
      </div>
      <address v-if="profile" class="site-footer__contacts">
        <span>{{ profile.city }}, {{ profile.address }}</span>
        <a :href="`tel:${profile.phone.replace(/[^+\d]/g, '')}`">{{ profile.phone }}</a>
        <span>{{ profile.hours[0]?.value }}</span>
      </address>
      <div class="site-footer__bottom">
        <span>© {{ year }} SHIFT Gaming Club</span>
        <nav class="site-footer__links" aria-label="Дополнительные ссылки">
          <NuxtLink to="/account">Личный кабинет</NuxtLink>
        </nav>
        <span>PLAY. CONNECT. REPEAT.</span>
      </div>
    </Container>
  </footer>
</template>

<style scoped>
.site-footer {
  border-top: 1px solid var(--line);
  padding: 48px 0 32px;
  color: var(--muted);
}
.site-footer__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
}
.site-footer__top a:first-child {
  color: var(--text);
}
.site-footer__top p {
  font-size: var(--fs-13);
}
.site-footer__contacts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 32px;
  margin-top: 32px;
  font-size: var(--fs-13);
  font-style: normal;
}
.site-footer__contacts a:hover {
  color: var(--acid);
}
.site-footer__bottom {
  border-top: 1px solid var(--line);
  padding-top: 32px;
  margin-top: 40px;
  display: flex;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  font-size: var(--fs-10);
}
.site-footer__links {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
@media (max-width: 760px) {
  .site-footer__top {
    flex-direction: column;
    align-items: start;
    gap: 16px;
  }
  .site-footer__bottom {
    display: grid;
    gap: 24px;
  }
}
</style>
