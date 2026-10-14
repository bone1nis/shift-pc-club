<script setup lang="ts">
import { AuthForm } from '@fsd/features/authenticate'
import { Container } from '@fsd/shared/ui'
</script>

<template>
  <Container>
    <section class="auth-page">
      <div class="auth-page__art">
        <span class="auth-page__eyebrow">Welcome to the next level</span>
        <h1>Твой вход<br />в <span>игру.</span></h1>
        <p>Бронируй места. Собирай команду. Следи за сессиями.</p>
      </div>
      <AuthForm />
    </section>
  </Container>
</template>

<style scoped>
.auth-page {
  min-height: calc(100vh - 224px);
  padding-top: 48px;
  padding-bottom: 80px;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 96px;
  align-items: center;
}
.auth-page__art {
  background:
    linear-gradient(90deg, var(--bg-a48), var(--bg)),
    url('/images/club-hero.webp') center/cover;
  padding: 64px 32px;
  min-height: 480px;
  display: flex;
  flex-direction: column;
  justify-content: end;
  border: 1px solid var(--line);
}
.auth-page__eyebrow {
  display: block;
  margin-bottom: 52px;
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--acid);
}
.auth-page__art h1 {
  font-size: var(--fs-96);
}
.auth-page__art h1 span {
  color: var(--acid);
}
.auth-page__art p {
  color: var(--muted);
}
@media (max-width: 1050px) {
  .auth-page {
    gap: 48px;
  }
}
@media (max-width: 760px) {
  .auth-page {
    padding-top: 32px;
    grid-template-columns: 1fr;
    gap: 24px;
    min-height: auto;
  }
  .auth-page__art {
    display: none;
  }
}
</style>
