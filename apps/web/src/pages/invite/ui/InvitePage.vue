<script setup lang="ts">
import { UiNotice, UiPanel, UiSkeleton } from '@shift/ui'
import { Container, LinkButton } from '@fsd/shared/ui'
import { useInviteAccept } from '../model/useInviteAccept'

const props = defineProps<{ token: string }>()
const { error, pending } = useInviteAccept(props.token)
</script>

<template>
  <Container>
    <section class="invite-page" :aria-busy="pending">
      <h1>Приглашение в чат брони</h1>
      <UiPanel v-if="pending" role="status">
        <span class="sr-only">Принимаем приглашение…</span>
        <UiSkeleton shape="text" width="60%" height="26px" />
      </UiPanel>
      <template v-else-if="error">
        <UiNotice tone="error">{{ error }}</UiNotice>
        <LinkButton to="/account">В личный кабинет</LinkButton>
      </template>
    </section>
  </Container>
</template>

<style scoped>
.invite-page {
  display: grid;
  gap: 16px;
  justify-items: start;
  padding-block: 48px;
}
</style>
