<script setup lang="ts">
import { onMounted } from 'vue'
import { navigateTo } from '#imports'
import { UiPanel } from '@shift/ui'
import { ComplaintForm } from '@fsd/features/send-complaint'
import { useUserStore } from '@fsd/entities/user'
import { Container, LinkButton } from '@fsd/shared/ui'

const user = useUserStore()
onMounted(async () => {
  await user.load()
  if (!user.user) await navigateTo('/auth?next=/account/feedback')
})
</script>

<template>
  <Container>
    <section class="feedback">
      <header class="feedback__heading">
        <h1>Жалоба или отзыв владельцу</h1>
        <LinkButton to="/account" variant="secondary">В кабинет</LinkButton>
      </header>
      <UiPanel>
        <ComplaintForm v-if="user.user" />
        <p v-else role="status">Проверяем вход…</p>
      </UiPanel>
    </section>
  </Container>
</template>

<style scoped>
.feedback {
  padding-top: 48px;
  padding-bottom: 80px;
  max-width: 720px;
}
.feedback__heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  margin-bottom: 32px;
}
</style>
